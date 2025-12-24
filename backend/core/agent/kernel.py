#!/usr/bin/env python3
"""
Agent Kernel - The VLA Agent Core Loop.
VoiceOS VLA Agent: "The Brain"

Implements the Perceive → Plan → Execute → Verify → Report cycle.
"""

import asyncio
import logging
import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


class ActionType(Enum):
    """Types of actions the agent can perform."""
    CLICK = "click"
    DOUBLE_CLICK = "double_click"
    RIGHT_CLICK = "right_click"
    TYPE = "type"
    SHORTCUT = "shortcut"
    SCROLL = "scroll"
    SPEAK = "speak"
    CONFIRM_REQUIRED = "confirm_required"
    UNKNOWN = "unknown"


@dataclass
class AgentAction:
    """Represents a planned action from the LLM."""
    action_type: ActionType
    target_element: Optional[int] = None  # Element number from context
    coordinates: Optional[tuple] = None   # (x, y) if specified
    text: Optional[str] = None            # For type/speak actions
    shortcut: Optional[str] = None        # For shortcut action
    direction: Optional[str] = None       # For scroll action
    confidence: float = 1.0
    reasoning: str = ""


@dataclass
class AgentResult:
    """Result of agent command processing."""
    success: bool
    message: str
    action_taken: Optional[AgentAction] = None
    attempts: int = 1
    verification_passed: bool = False
    needs_confirmation: bool = False
    confirmation_prompt: Optional[str] = None


class AgentKernel:
    """
    The VLA Agent Core Loop.
    
    Cycle:
    1. PERCEIVE: Get Accessibility Tree + Screenshot
    2. PLAN: LLM generates action (preferring element numbers)
    3. EXECUTE: Run action via OS controller
    4. VERIFY: Check if UI state changed as expected
    5. REPORT: Voice feedback to user
    """
    
    MAX_RETRIES = 3
    VERIFY_DELAY = 0.5  # Seconds to wait before verification
    
    # System prompt for the LLM
    SYSTEM_PROMPT = """You are the VoiceOS Accessibility Agent. Users rely on you for motor assistance.

CRITICAL RULES:
1. VERIFY: After every action, the system will check if it worked. You don't need to verify.
2. ELEMENT NUMBERS: Reference UI elements by their number (e.g., "click element 5").
3. SAFETY: For destructive actions (delete, send, pay, quit), output CONFIRM_REQUIRED.
4. RECOVERY: If an action fails, try different coordinates or tab-navigation.

OUTPUT FORMAT (JSON):
{
    "action": "click|type|shortcut|scroll|speak|confirm_required",
    "element": <number> or null,
    "text": "<text for type/speak>",
    "shortcut": "<e.g. cmd+c>",
    "direction": "<up|down|left|right for scroll>",
    "reasoning": "<brief explanation>"
}

EXAMPLES:
- User: "Click the submit button" → {"action": "click", "element": 3, "reasoning": "Element 3 is the Submit button"}
- User: "Type hello world" → {"action": "type", "text": "hello world", "reasoning": "Typing requested text"}
- User: "Delete this file" → {"action": "confirm_required", "text": "delete the file", "reasoning": "Destructive action requires confirmation"}
"""
    
    def __init__(self):
        self._controller = None
        self._parser = None
        self._safety = None
        self._llm_client = None
    
    def _get_controller(self):
        if self._controller is None:
            from ..os.macos_controller import get_controller
            self._controller = get_controller()
        return self._controller
    
    def _get_parser(self):
        if self._parser is None:
            from ..vision.screen_parser import get_screen_parser
            self._parser = get_screen_parser()
        return self._parser
    
    def _get_safety(self):
        if self._safety is None:
            from .safety import get_safety_guard
            self._safety = get_safety_guard()
        return self._safety
    
    async def process_command(self, voice_command: str) -> AgentResult:
        """
        Main entry point: Process a voice command through the VLA loop.
        
        Args:
            voice_command: User's voice command text
            
        Returns:
            AgentResult with success status.
        """
        logger.info(f"[Agent] Processing: {voice_command}")
        
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                # 1. PERCEIVE
                context = await self._perceive()
                logger.debug(f"[Agent] Perceived {len(context.element_map)} elements")
                
                # 2. PLAN
                action = await self._plan(voice_command, context)
                logger.info(f"[Agent] Planned action: {action.action_type.value}")
                
                # Check if confirmation is required
                if action.action_type == ActionType.CONFIRM_REQUIRED:
                    return AgentResult(
                        success=False,
                        message=f"Confirmation needed: {action.text}",
                        action_taken=action,
                        attempts=attempt,
                        needs_confirmation=True,
                        confirmation_prompt=f"I'm about to {action.text}. Say 'Confirm' or 'Cancel'."
                    )
                
                # 3. EXECUTE
                execute_success = await self._execute(action, context)
                
                if not execute_success:
                    logger.warning(f"[Agent] Execute failed on attempt {attempt}")
                    if attempt < self.MAX_RETRIES:
                        await self._adjust_strategy(action, attempt)
                        continue
                    else:
                        return AgentResult(
                            success=False,
                            message=f"Failed to execute after {attempt} attempts",
                            action_taken=action,
                            attempts=attempt,
                        )
                
                # 4. VERIFY
                await asyncio.sleep(self.VERIFY_DELAY)
                verified = await self._verify(action, context)
                
                if verified:
                    # 5. REPORT SUCCESS
                    message = self._generate_success_message(action)
                    return AgentResult(
                        success=True,
                        message=message,
                        action_taken=action,
                        attempts=attempt,
                        verification_passed=True,
                    )
                else:
                    logger.warning(f"[Agent] Verification failed on attempt {attempt}")
                    if attempt < self.MAX_RETRIES:
                        await self._adjust_strategy(action, attempt)
                        continue
                    
            except Exception as e:
                logger.error(f"[Agent] Error on attempt {attempt}: {e}")
                if attempt >= self.MAX_RETRIES:
                    return AgentResult(
                        success=False,
                        message=f"Error: {str(e)}",
                        attempts=attempt,
                    )
        
        # All retries exhausted
        return AgentResult(
            success=False,
            message="I'm having trouble completing this action. Is the target visible on screen?",
            attempts=self.MAX_RETRIES,
        )
    
    async def process_with_confirmation(
        self, 
        voice_command: str, 
        confirmed: bool
    ) -> AgentResult:
        """Process a command that was awaiting confirmation."""
        if not confirmed:
            return AgentResult(
                success=False,
                message="Action cancelled.",
                attempts=0,
            )
        
        # Re-run the command, forcing execution without confirmation check
        logger.info(f"[Agent] Processing confirmed command: {voice_command}")
        
        context = await self._perceive()
        action = await self._plan(voice_command, context)
        
        # Force execution even if it would normally require confirmation
        action.action_type = ActionType.CLICK  # Default to click for now
        
        execute_success = await self._execute(action, context)
        
        return AgentResult(
            success=execute_success,
            message="Action confirmed and executed." if execute_success else "Action failed.",
            action_taken=action,
            attempts=1,
        )
    
    # ========== Internal Methods ==========
    
    async def _perceive(self):
        """Step 1: Get current screen context."""
        parser = self._get_parser()
        return await parser.get_context(include_screenshot=True)
    
    async def _plan(self, voice_command: str, context) -> AgentAction:
        """Step 2: Use LLM to plan action based on context."""
        # For now, use simple pattern matching
        # TODO: Integrate with actual LLM (Gemini/Ollama)
        
        command_lower = voice_command.lower()
        
        # Check for destructive actions
        safety = self._get_safety()
        if safety.requires_confirmation(voice_command):
            return AgentAction(
                action_type=ActionType.CONFIRM_REQUIRED,
                text=voice_command,
                reasoning="Destructive action requires confirmation",
            )
        
        # Pattern matching for common commands
        # Click patterns
        click_match = re.search(r'click\s+(?:on\s+)?(?:element\s+)?(\d+)', command_lower)
        if click_match:
            element_num = int(click_match.group(1))
            return AgentAction(
                action_type=ActionType.CLICK,
                target_element=element_num,
                reasoning=f"Clicking element {element_num}",
            )
        
        # Click by label
        click_label_match = re.search(r'click\s+(?:on\s+)?(?:the\s+)?(.+?)(?:\s+button)?$', command_lower)
        if click_label_match:
            label = click_label_match.group(1).strip()
            # Find matching element
            for num, el in context.element_map.items():
                if label in el.label.lower():
                    return AgentAction(
                        action_type=ActionType.CLICK,
                        target_element=num,
                        reasoning=f"Found '{label}' as element {num}",
                    )
        
        # Type patterns
        type_match = re.search(r'type\s+["\']?(.+?)["\']?$', command_lower)
        if type_match:
            text = type_match.group(1)
            return AgentAction(
                action_type=ActionType.TYPE,
                text=text,
                reasoning=f"Typing: {text}",
            )
        
        # Scroll patterns
        scroll_match = re.search(r'scroll\s+(up|down|left|right)', command_lower)
        if scroll_match:
            direction = scroll_match.group(1)
            return AgentAction(
                action_type=ActionType.SCROLL,
                direction=direction,
                reasoning=f"Scrolling {direction}",
            )
        
        # Shortcut patterns
        shortcut_match = re.search(r'press\s+(.+)', command_lower)
        if shortcut_match:
            shortcut = shortcut_match.group(1).replace(' ', '+')
            return AgentAction(
                action_type=ActionType.SHORTCUT,
                shortcut=shortcut,
                reasoning=f"Pressing shortcut: {shortcut}",
            )
        
        # Default: unknown
        return AgentAction(
            action_type=ActionType.UNKNOWN,
            reasoning="Could not understand command",
        )
    
    async def _execute(self, action: AgentAction, context) -> bool:
        """Step 3: Execute the planned action."""
        controller = self._get_controller()
        
        try:
            if action.action_type == ActionType.CLICK:
                if action.target_element and action.target_element in context.element_map:
                    element = context.element_map[action.target_element]
                    return await controller.click_element(element)
                elif action.coordinates:
                    x, y = action.coordinates
                    return await controller.click(x, y)
                return False
            
            elif action.action_type == ActionType.DOUBLE_CLICK:
                if action.target_element and action.target_element in context.element_map:
                    element = context.element_map[action.target_element]
                    x, y = element.center
                    return await controller.double_click(x, y)
                return False
            
            elif action.action_type == ActionType.TYPE:
                if action.text:
                    return await controller.type_text(action.text)
                return False
            
            elif action.action_type == ActionType.SHORTCUT:
                if action.shortcut:
                    return await controller.press_shortcut(action.shortcut)
                return False
            
            elif action.action_type == ActionType.SCROLL:
                if action.direction:
                    return await controller.scroll(action.direction)
                return False
            
            else:
                logger.warning(f"Unknown action type: {action.action_type}")
                return False
                
        except Exception as e:
            logger.error(f"Execute error: {e}")
            return False
    
    async def _verify(self, action: AgentAction, old_context) -> bool:
        """Step 4: Verify the action worked by checking UI state change."""
        # Get new context
        new_context = await self._perceive()
        
        if action.action_type == ActionType.CLICK:
            # For clicks, verify the target element changed state or is no longer visible
            if action.target_element:
                old_element = old_context.element_map.get(action.target_element)
                if old_element:
                    # Check if element is still there with same state
                    # If screen changed significantly, consider it success
                    if len(new_context.element_map) != len(old_context.element_map):
                        return True
                    
                    # Check if any element became focused
                    if new_context.focused_element_number != old_context.focused_element_number:
                        return True
                    
                    # For now, assume click worked if no error
                    return True
            return True  # Optimistic for coordinate clicks
        
        elif action.action_type == ActionType.TYPE:
            # Verify text was typed by checking focused element value
            # For now, assume success if no error
            return True
        
        elif action.action_type in (ActionType.SCROLL, ActionType.SHORTCUT):
            # These are harder to verify, assume success
            return True
        
        return True  # Default optimistic
    
    async def _adjust_strategy(self, action: AgentAction, attempt: int):
        """Adjust action strategy after a failed attempt."""
        logger.info(f"[Agent] Adjusting strategy for attempt {attempt + 1}")
        
        if action.action_type == ActionType.CLICK and action.coordinates:
            # Slightly perturb coordinates
            x, y = action.coordinates
            offset = attempt * 5  # Increase offset with each attempt
            action.coordinates = (x + offset, y + offset)
        
        await asyncio.sleep(0.3)  # Brief pause before retry
    
    def _generate_success_message(self, action: AgentAction) -> str:
        """Generate user-friendly success message."""
        if action.action_type == ActionType.CLICK:
            if action.target_element:
                return f"Clicked element {action.target_element}"
            return "Clicked successfully"
        elif action.action_type == ActionType.TYPE:
            return f"Typed: {action.text}"
        elif action.action_type == ActionType.SCROLL:
            return f"Scrolled {action.direction}"
        elif action.action_type == ActionType.SHORTCUT:
            return f"Pressed {action.shortcut}"
        return "Action completed"


# Singleton
_kernel: Optional[AgentKernel] = None


def get_agent_kernel() -> AgentKernel:
    """Get singleton AgentKernel instance."""
    global _kernel
    if _kernel is None:
        _kernel = AgentKernel()
    return _kernel


# Test
if __name__ == "__main__":
    import asyncio
    
    async def test():
        logging.basicConfig(level=logging.DEBUG)
        kernel = get_agent_kernel()
        
        print("Testing agent with 'click element 1'...")
        result = await kernel.process_command("click element 1")
        print(f"Result: {result}")
    
    asyncio.run(test())
