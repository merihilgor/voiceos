#!/usr/bin/env python3
"""
macOS Controller - Implements AbstractController for macOS.
Uses Quartz for mouse control and ApplicationServices for Accessibility Tree.

VoiceOS VLA Agent: "The Hands" - macOS Implementation
"""

import asyncio
import logging
import subprocess
from typing import List, Optional, Tuple

from .controller_base import AbstractController, UIElement, ScreenContext

logger = logging.getLogger(__name__)

# Try to import macOS-specific libraries
try:
    from Quartz import (
        CGEventCreateMouseEvent,
        CGEventPost,
        CGEventCreateScrollWheelEvent,
        kCGEventMouseMoved,
        kCGEventLeftMouseDown,
        kCGEventLeftMouseUp,
        kCGEventRightMouseDown,
        kCGEventRightMouseUp,
        kCGEventScrollWheel,
        kCGMouseButtonLeft,
        kCGMouseButtonRight,
        kCGHIDEventTap,
        kCGScrollEventUnitLine,
    )
    QUARTZ_AVAILABLE = True
except ImportError:
    QUARTZ_AVAILABLE = False
    logger.warning("Quartz not available - mouse control will be limited")

try:
    from ApplicationServices import (
        AXUIElementCreateSystemWide,
        AXUIElementCopyAttributeValue,
        AXUIElementCopyElementAtPosition,
        AXUIElementPerformAction,
        kAXFocusedApplicationAttribute,
        kAXFocusedUIElementAttribute,
        kAXWindowsAttribute,
        kAXChildrenAttribute,
        kAXRoleAttribute,
        kAXTitleAttribute,
        kAXDescriptionAttribute,
        kAXValueAttribute,
        kAXPositionAttribute,
        kAXSizeAttribute,
        kAXEnabledAttribute,
        kAXFocusedAttribute,
        kAXPressAction,
    )
    from Quartz import CGPointMake
    AX_AVAILABLE = True
except ImportError:
    AX_AVAILABLE = False
    logger.warning("ApplicationServices not available - accessibility tree will be limited")


class MacOSController(AbstractController):
    """macOS implementation of OS controller with full accessibility support."""
    
    def __init__(self):
        self._system_wide = None
        if AX_AVAILABLE:
            self._system_wide = AXUIElementCreateSystemWide()
        
        # Import screen capture for screenshots
        try:
            from ..screen_capture import get_screen_capture
            self._screen_capture = get_screen_capture()
        except ImportError:
            self._screen_capture = None
    
    # ========== Mouse Actions ==========
    
    async def click(self, x: int, y: int) -> bool:
        """Click at screen coordinates using Quartz."""
        if not QUARTZ_AVAILABLE:
            return await self._click_via_applescript(x, y)
        
        try:
            # Move mouse to position
            move_event = CGEventCreateMouseEvent(None, kCGEventMouseMoved, (x, y), kCGMouseButtonLeft)
            CGEventPost(kCGHIDEventTap, move_event)
            await asyncio.sleep(0.05)
            
            # Mouse down
            down_event = CGEventCreateMouseEvent(None, kCGEventLeftMouseDown, (x, y), kCGMouseButtonLeft)
            CGEventPost(kCGHIDEventTap, down_event)
            await asyncio.sleep(0.05)
            
            # Mouse up
            up_event = CGEventCreateMouseEvent(None, kCGEventLeftMouseUp, (x, y), kCGMouseButtonLeft)
            CGEventPost(kCGHIDEventTap, up_event)
            
            logger.debug(f"Clicked at ({x}, {y})")
            return True
        except Exception as e:
            logger.error(f"Click failed: {e}")
            return False
    
    async def double_click(self, x: int, y: int) -> bool:
        """Double-click at screen coordinates."""
        result1 = await self.click(x, y)
        await asyncio.sleep(0.1)
        result2 = await self.click(x, y)
        return result1 and result2
    
    async def right_click(self, x: int, y: int) -> bool:
        """Right-click at screen coordinates."""
        if not QUARTZ_AVAILABLE:
            return await self._right_click_via_applescript(x, y)
        
        try:
            move_event = CGEventCreateMouseEvent(None, kCGEventMouseMoved, (x, y), kCGMouseButtonRight)
            CGEventPost(kCGHIDEventTap, move_event)
            await asyncio.sleep(0.05)
            
            down_event = CGEventCreateMouseEvent(None, kCGEventRightMouseDown, (x, y), kCGMouseButtonRight)
            CGEventPost(kCGHIDEventTap, down_event)
            await asyncio.sleep(0.05)
            
            up_event = CGEventCreateMouseEvent(None, kCGEventRightMouseUp, (x, y), kCGMouseButtonRight)
            CGEventPost(kCGHIDEventTap, up_event)
            
            logger.debug(f"Right-clicked at ({x}, {y})")
            return True
        except Exception as e:
            logger.error(f"Right-click failed: {e}")
            return False
    
    async def scroll(self, direction: str, amount: int = 3) -> bool:
        """Scroll in specified direction."""
        if not QUARTZ_AVAILABLE:
            return await self._scroll_via_applescript(direction, amount)
        
        try:
            # Determine scroll delta
            if direction == 'up':
                delta_y, delta_x = amount, 0
            elif direction == 'down':
                delta_y, delta_x = -amount, 0
            elif direction == 'left':
                delta_y, delta_x = 0, amount
            elif direction == 'right':
                delta_y, delta_x = 0, -amount
            else:
                logger.warning(f"Unknown scroll direction: {direction}")
                return False
            
            scroll_event = CGEventCreateScrollWheelEvent(
                None, kCGScrollEventUnitLine, 2, delta_y, delta_x
            )
            CGEventPost(kCGHIDEventTap, scroll_event)
            
            logger.debug(f"Scrolled {direction} by {amount}")
            return True
        except Exception as e:
            logger.error(f"Scroll failed: {e}")
            return False
    
    # ========== Keyboard Actions ==========
    
    async def type_text(self, text: str) -> bool:
        """Type text using AppleScript (most reliable for text input)."""
        try:
            escaped = text.replace('\\', '\\\\').replace('"', '\\"')
            script = f'tell application "System Events" to keystroke "{escaped}"'
            subprocess.run(['osascript', '-e', script], check=True, capture_output=True)
            logger.debug(f"Typed: {text[:50]}...")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Type text failed: {e.stderr.decode()}")
            return False
    
    async def press_shortcut(self, shortcut: str) -> bool:
        """Press keyboard shortcut using AppleScript."""
        parts = shortcut.lower().split('+')
        key = parts[-1]
        modifiers = parts[:-1]
        
        modifier_str = ""
        if 'cmd' in modifiers or 'command' in modifiers:
            modifier_str += "command down, "
        if 'shift' in modifiers:
            modifier_str += "shift down, "
        if 'alt' in modifiers or 'option' in modifiers:
            modifier_str += "option down, "
        if 'ctrl' in modifiers or 'control' in modifiers:
            modifier_str += "control down, "
        
        modifier_str = modifier_str.rstrip(", ")
        
        try:
            if modifier_str:
                script = f'tell application "System Events" to keystroke "{key}" using {{{modifier_str}}}'
            else:
                script = f'tell application "System Events" to keystroke "{key}"'
            
            subprocess.run(['osascript', '-e', script], check=True, capture_output=True)
            logger.debug(f"Pressed shortcut: {shortcut}")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Shortcut failed: {e.stderr.decode()}")
            return False
    
    # ========== Accessibility Tree ==========
    
    async def get_ui_tree(self) -> List[UIElement]:
        """Get accessibility tree of focused window."""
        if not AX_AVAILABLE:
            logger.warning("Accessibility APIs not available")
            return []
        
        elements = []
        try:
            # Get focused application
            err, focused_app = AXUIElementCopyAttributeValue(
                self._system_wide, kAXFocusedApplicationAttribute, None
            )
            if err != 0 or focused_app is None:
                return []
            
            # Get windows
            err, windows = AXUIElementCopyAttributeValue(focused_app, kAXWindowsAttribute, None)
            if err != 0 or not windows:
                return []
            
            # Parse first window's children recursively
            if len(windows) > 0:
                elements = await self._parse_element_tree(windows[0], max_depth=5)
            
        except Exception as e:
            logger.error(f"Failed to get UI tree: {e}")
        
        return elements
    
    async def _parse_element_tree(self, element, depth: int = 0, max_depth: int = 5) -> List[UIElement]:
        """Recursively parse accessibility element tree."""
        if depth > max_depth:
            return []
        
        elements = []
        
        try:
            # Get element attributes
            _, role = AXUIElementCopyAttributeValue(element, kAXRoleAttribute, None)
            _, title = AXUIElementCopyAttributeValue(element, kAXTitleAttribute, None)
            _, desc = AXUIElementCopyAttributeValue(element, kAXDescriptionAttribute, None)
            _, value = AXUIElementCopyAttributeValue(element, kAXValueAttribute, None)
            _, position = AXUIElementCopyAttributeValue(element, kAXPositionAttribute, None)
            _, size = AXUIElementCopyAttributeValue(element, kAXSizeAttribute, None)
            _, enabled = AXUIElementCopyAttributeValue(element, kAXEnabledAttribute, None)
            _, focused = AXUIElementCopyAttributeValue(element, kAXFocusedAttribute, None)
            
            # Build label from title or description
            label = str(title or desc or value or role or "")
            
            # Get bounds
            bounds = (0, 0, 0, 0)
            if position and size:
                try:
                    x, y = position.x, position.y
                    w, h = size.width, size.height
                    bounds = (int(x), int(y), int(w), int(h))
                except:
                    pass
            
            # Create UIElement if it has useful info
            if role and (label or bounds != (0, 0, 0, 0)):
                ui_el = UIElement(
                    id=str(id(element)),
                    label=label,
                    role=str(role),
                    bounds=bounds,
                    value=str(value) if value else None,
                    enabled=bool(enabled) if enabled is not None else True,
                    focused=bool(focused) if focused is not None else False,
                )
                elements.append(ui_el)
            
            # Parse children
            _, children = AXUIElementCopyAttributeValue(element, kAXChildrenAttribute, None)
            if children:
                for child in children:
                    child_elements = await self._parse_element_tree(child, depth + 1, max_depth)
                    elements.extend(child_elements)
                    
        except Exception as e:
            logger.debug(f"Error parsing element: {e}")
        
        return elements
    
    async def get_focused_element(self) -> Optional[UIElement]:
        """Get currently focused UI element."""
        if not AX_AVAILABLE:
            return None
        
        try:
            err, focused_el = AXUIElementCopyAttributeValue(
                self._system_wide, kAXFocusedUIElementAttribute, None
            )
            if err != 0 or focused_el is None:
                return None
            
            # Parse just this element
            elements = await self._parse_element_tree(focused_el, max_depth=0)
            return elements[0] if elements else None
            
        except Exception as e:
            logger.error(f"Failed to get focused element: {e}")
            return None
    
    async def get_screen_context(self) -> ScreenContext:
        """Get full screen context for LLM."""
        elements = await self.get_ui_tree()
        focused = await self.get_focused_element()
        
        # Get active app/window info
        app_name = ""
        window_title = ""
        try:
            script = 'tell application "System Events" to get name of first process whose frontmost is true'
            result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
            app_name = result.stdout.strip()
            
            script = 'tell application "System Events" to get title of first window of first process whose frontmost is true'
            result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
            window_title = result.stdout.strip()
        except:
            pass
        
        # Get screenshot
        screenshot_b64 = None
        if self._screen_capture:
            screenshot_b64 = self._screen_capture.capture_screen()
        
        return ScreenContext(
            elements=elements,
            focused_element=focused,
            screenshot_b64=screenshot_b64,
            window_title=window_title,
            app_name=app_name,
        )
    
    async def click_element(self, element: UIElement) -> bool:
        """Click on a UIElement by its center point."""
        x, y = element.center
        return await self.click(x, y)
    
    async def focus_element(self, element: UIElement) -> bool:
        """Focus element (click to focus)."""
        return await self.click_element(element)
    
    # ========== AppleScript Fallbacks ==========
    
    async def _click_via_applescript(self, x: int, y: int) -> bool:
        """Fallback click using AppleScript."""
        try:
            script = f'''
            tell application "System Events"
                click at {{{x}, {y}}}
            end tell
            '''
            subprocess.run(['osascript', '-e', script], check=True, capture_output=True)
            return True
        except:
            return False
    
    async def _right_click_via_applescript(self, x: int, y: int) -> bool:
        """Fallback right-click using AppleScript."""
        try:
            # AppleScript doesn't directly support right-click at coordinates
            # Use control-click as alternative
            script = f'''
            tell application "System Events"
                key down control
                click at {{{x}, {y}}}
                key up control
            end tell
            '''
            subprocess.run(['osascript', '-e', script], check=True, capture_output=True)
            return True
        except:
            return False
    
    async def _scroll_via_applescript(self, direction: str, amount: int) -> bool:
        """Fallback scroll using AppleScript."""
        try:
            # Map direction to key code
            key_map = {'up': 126, 'down': 125, 'left': 123, 'right': 124}
            key_code = key_map.get(direction)
            if not key_code:
                return False
            
            for _ in range(amount):
                script = f'tell application "System Events" to key code {key_code}'
                subprocess.run(['osascript', '-e', script], check=True, capture_output=True)
            return True
        except:
            return False


# Singleton instance
_controller: Optional[MacOSController] = None


def get_controller() -> MacOSController:
    """Get singleton MacOSController instance."""
    global _controller
    if _controller is None:
        _controller = MacOSController()
    return _controller


# For testing
if __name__ == "__main__":
    import asyncio
    
    async def test():
        logging.basicConfig(level=logging.DEBUG)
        controller = get_controller()
        
        print("Getting screen context...")
        ctx = await controller.get_screen_context()
        print(f"App: {ctx.app_name}, Window: {ctx.window_title}")
        print(f"Found {len(ctx.elements)} UI elements")
        print(ctx.to_text_list()[:1000])
        
        # Test click (move mouse to safe position)
        # print("Clicking at (100, 100)...")
        # await controller.click(100, 100)
    
    asyncio.run(test())
