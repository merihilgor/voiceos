#!/usr/bin/env python3
"""
Safety Guard - Voice confirmation and error recovery for accessibility.
VoiceOS VLA Agent: Safety Layer

Ensures destructive actions require voice confirmation.
Implements error recovery with voice feedback.
"""

import logging
import re
import subprocess
from typing import Optional, List

logger = logging.getLogger(__name__)


class SafetyGuard:
    """
    Safety layer for accessibility-first OS control.
    
    Features:
    - Detects sensitive/destructive actions
    - Manages voice confirmation flow
    - Provides error recovery with voice feedback
    """
    
    # Patterns that indicate destructive actions
    SENSITIVE_PATTERNS = [
        # Deletion
        r'\b(delete|remove|trash|erase|clear|empty)\b',
        # Sending/Publishing
        r'\b(send|submit|post|publish|share)\b',
        # Financial
        r'\b(pay|purchase|buy|transfer|checkout|order)\b',
        # System
        r'\b(quit|shutdown|restart|reboot|logout|signout|close\s+all)\b',
        # Permanent changes
        r'\b(format|wipe|reset|uninstall|permanently)\b',
    ]
    
    # Actions that are always safe
    SAFE_PATTERNS = [
        r'\b(open|view|show|read|look|find|search|scroll|navigate)\b',
        r'\b(copy|select|highlight)\b',
    ]
    
    def __init__(self):
        self._compiled_sensitive = [re.compile(p, re.IGNORECASE) for p in self.SENSITIVE_PATTERNS]
        self._compiled_safe = [re.compile(p, re.IGNORECASE) for p in self.SAFE_PATTERNS]
        self._pending_confirmation: Optional[str] = None
    
    def requires_confirmation(self, command: str) -> bool:
        """
        Check if a command requires voice confirmation.
        
        Args:
            command: The voice command text
            
        Returns:
            True if confirmation is needed
        """
        # First check if it's explicitly safe
        for pattern in self._compiled_safe:
            if pattern.search(command):
                return False
        
        # Then check if it matches sensitive patterns
        for pattern in self._compiled_sensitive:
            if pattern.search(command):
                logger.info(f"[Safety] Command requires confirmation: {command}")
                return True
        
        return False
    
    def get_confirmation_prompt(self, command: str) -> str:
        """
        Generate a voice confirmation prompt for the user.
        
        Args:
            command: The sensitive command
            
        Returns:
            TTS-friendly prompt string
        """
        # Extract the action type for clearer prompt
        action = "perform this action"
        
        if re.search(r'\bdelete\b', command, re.IGNORECASE):
            action = "delete this"
        elif re.search(r'\bsend\b', command, re.IGNORECASE):
            action = "send this"
        elif re.search(r'\bquit\b', command, re.IGNORECASE):
            action = "quit this application"
        elif re.search(r'\bpay\b|\bpurchase\b', command, re.IGNORECASE):
            action = "complete this payment"
        elif re.search(r'\bsubmit\b', command, re.IGNORECASE):
            action = "submit this"
        
        return f"I'm about to {action}. Say 'Confirm' to proceed or 'Cancel' to stop."
    
    def parse_confirmation_response(self, response: str) -> Optional[bool]:
        """
        Parse user's voice response to confirmation prompt.
        
        Args:
            response: User's voice response
            
        Returns:
            True if confirmed, False if cancelled, None if unclear
        """
        response_lower = response.lower().strip()
        
        # Confirm patterns
        if any(word in response_lower for word in ['confirm', 'yes', 'proceed', 'go ahead', 'do it', 'okay']):
            return True
        
        # Cancel patterns
        if any(word in response_lower for word in ['cancel', 'no', 'stop', 'abort', 'never mind', "don't"]):
            return False
        
        return None  # Unclear response
    
    async def speak(self, text: str) -> bool:
        """
        Speak text using macOS TTS.
        Non-blocking for accessibility responsiveness.
        """
        try:
            # Use subprocess for non-blocking TTS
            subprocess.Popen(['say', text], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except Exception as e:
            logger.error(f"TTS failed: {e}")
            return False
    
    async def announce_error(self, error_message: str, attempts: int = 0):
        """Announce an error to the user via TTS."""
        if attempts >= 3:
            message = "I'm having trouble completing this action. Is the target currently visible on your screen?"
        else:
            message = f"Action failed: {error_message}. Retrying."
        
        await self.speak(message)
    
    async def announce_success(self, action_description: str):
        """Announce successful action completion."""
        await self.speak(f"Done. {action_description}")
    
    async def request_confirmation(self, command: str) -> str:
        """
        Speak confirmation prompt and return the prompt text.
        The actual listening for response is handled by the main voice loop.
        """
        prompt = self.get_confirmation_prompt(command)
        await self.speak(prompt)
        self._pending_confirmation = command
        return prompt
    
    def has_pending_confirmation(self) -> bool:
        """Check if there's a pending confirmation."""
        return self._pending_confirmation is not None
    
    def get_pending_command(self) -> Optional[str]:
        """Get the command awaiting confirmation."""
        return self._pending_confirmation
    
    def clear_pending_confirmation(self):
        """Clear pending confirmation state."""
        self._pending_confirmation = None


# Singleton
_safety: Optional[SafetyGuard] = None


def get_safety_guard() -> SafetyGuard:
    """Get singleton SafetyGuard instance."""
    global _safety
    if _safety is None:
        _safety = SafetyGuard()
    return _safety


# Test
if __name__ == "__main__":
    import asyncio
    
    async def test():
        logging.basicConfig(level=logging.DEBUG)
        safety = get_safety_guard()
        
        # Test sensitive detection
        test_commands = [
            "open my email",           # Safe
            "delete this file",        # Sensitive
            "send this message",       # Sensitive
            "scroll down",             # Safe
            "pay for this item",       # Sensitive
            "quit Safari",             # Sensitive
            "click the submit button", # Safe (submit is sensitive, but click is the action)
        ]
        
        for cmd in test_commands:
            needs_confirm = safety.requires_confirmation(cmd)
            print(f"'{cmd}' → {'⚠️ CONFIRM' if needs_confirm else '✅ SAFE'}")
        
        # Test confirmation parsing
        responses = ["yes", "confirm", "no", "cancel", "what?"]
        for resp in responses:
            result = safety.parse_confirmation_response(resp)
            print(f"Response '{resp}' → {result}")
    
    asyncio.run(test())
