#!/usr/bin/env python3
"""
Screen Parser - Converts screen state to LLM-friendly context.
VoiceOS VLA Agent: "The Eyes" - Context Generator

Prioritizes Accessibility Tree for accuracy, adds visual context via screenshot.
"""

import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class ParsedContext:
    """LLM-optimized screen context."""
    text_description: str           # Numbered list of UI elements
    screenshot_b64: Optional[str]   # Low-res screenshot for vision LLM
    element_map: dict               # {number: UIElement} for action mapping
    app_name: str
    window_title: str
    focused_element_number: Optional[int]
    
    def get_element_by_number(self, number: int):
        """Get UIElement by its assigned number."""
        return self.element_map.get(number)


class ScreenParser:
    """
    Parses screen state into LLM-friendly format.
    
    Strategy:
    1. Fetch Accessibility Tree (accurate, semantic)
    2. Capture low-res screenshot (visual context)
    3. Generate numbered element list for easy reference
    """
    
    def __init__(self):
        self._controller = None
        self._labeler = None
    
    def _get_controller(self):
        """Lazy-load controller to avoid import cycles."""
        if self._controller is None:
            from ..os.macos_controller import get_controller
            self._controller = get_controller()
        return self._controller
    
    def _get_labeler(self):
        """Lazy-load UI labeler."""
        if self._labeler is None:
            from .ui_labeler import UILabeler
            self._labeler = UILabeler()
        return self._labeler
    
    async def get_context(self, include_screenshot: bool = True) -> ParsedContext:
        """
        Get full screen context for LLM.
        
        Returns ParsedContext with:
        - Numbered text list of UI elements
        - Screenshot (optional, for vision LLMs)
        - Element mapping for action execution
        """
        controller = self._get_controller()
        screen_ctx = await controller.get_screen_context()
        
        # Filter to interactive elements
        interactive_roles = {
            'button', 'link', 'textfield', 'checkbox', 'radiobutton',
            'combobox', 'slider', 'menu', 'menuitem', 'tab', 'list',
            'row', 'cell', 'popupbutton', 'scrollbar', 'toolbar',
            'AXButton', 'AXLink', 'AXTextField', 'AXCheckBox',
        }
        
        interactive = [
            el for el in screen_ctx.elements
            if el.role.lower() in interactive_roles or 'button' in el.role.lower()
        ]
        
        # Build numbered list and mapping
        element_map = {}
        lines = [
            f"🖥️ Active App: {screen_ctx.app_name}",
            f"📋 Window: {screen_ctx.window_title}",
            "",
            "Interactive Elements:"
        ]
        
        focused_number = None
        for i, el in enumerate(interactive[:40], 1):  # Limit to 40 elements
            element_map[i] = el
            
            status = ""
            if el.focused:
                status = "🎯 "
                focused_number = i
            elif not el.enabled:
                status = "🚫 "
            
            label = el.label or "(unlabeled)"
            role = el.role.replace('AX', '').lower()
            
            lines.append(f"  {i}. {status}[{role}] {label}")
        
        if not interactive:
            lines.append("  (No interactive elements found)")
        
        text_description = "\n".join(lines)
        
        # Get screenshot if requested
        screenshot = None
        if include_screenshot and screen_ctx.screenshot_b64:
            # Optionally add SoM overlay
            try:
                labeler = self._get_labeler()
                screenshot = labeler.add_labels_to_screenshot(
                    screen_ctx.screenshot_b64, 
                    interactive[:40]
                )
            except Exception as e:
                logger.warning(f"Failed to add SoM labels: {e}")
                screenshot = screen_ctx.screenshot_b64
        
        return ParsedContext(
            text_description=text_description,
            screenshot_b64=screenshot,
            element_map=element_map,
            app_name=screen_ctx.app_name,
            window_title=screen_ctx.window_title,
            focused_element_number=focused_number,
        )
    
    async def get_element_at_position(self, x: int, y: int):
        """Get UI element at screen position."""
        controller = self._get_controller()
        elements = await controller.get_ui_tree()
        
        for el in elements:
            ex, ey, ew, eh = el.bounds
            if ex <= x <= ex + ew and ey <= y <= ey + eh:
                return el
        return None
    
    async def find_element_like(self, description: str) -> Tuple[Optional[int], Optional[object]]:
        """
        Find element matching description.
        Returns (element_number, element) or (None, None).
        """
        ctx = await self.get_context(include_screenshot=False)
        desc_lower = description.lower()
        
        for num, el in ctx.element_map.items():
            if desc_lower in el.label.lower():
                return num, el
        
        # Fuzzy match on role
        for num, el in ctx.element_map.items():
            if desc_lower in el.role.lower():
                return num, el
        
        return None, None


# Singleton
_parser: Optional[ScreenParser] = None


def get_screen_parser() -> ScreenParser:
    """Get singleton ScreenParser instance."""
    global _parser
    if _parser is None:
        _parser = ScreenParser()
    return _parser


# Test
if __name__ == "__main__":
    import asyncio
    
    async def test():
        logging.basicConfig(level=logging.DEBUG)
        parser = get_screen_parser()
        
        print("Getting screen context...")
        ctx = await parser.get_context(include_screenshot=False)
        print(ctx.text_description)
        print(f"\nElement map has {len(ctx.element_map)} elements")
    
    asyncio.run(test())
