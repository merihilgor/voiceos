#!/usr/bin/env python3
"""
Action Executor - Executes parsed actions on macOS.
Handles keystrokes, shortcuts, app launching, and TTS.
"""

import logging
import subprocess
import time
from typing import Optional

logger = logging.getLogger(__name__)

# Try to import PyObjC for keystroke simulation
try:
    from Quartz import (
        CGEventCreateKeyboardEvent,
        CGEventPost,
        CGEventSetFlags,
        kCGHIDEventTap,
        kCGEventFlagMaskCommand,
        kCGEventFlagMaskShift,
        kCGEventFlagMaskAlternate,
        kCGEventFlagMaskControl,
    )
    from AppKit import NSEvent
    QUARTZ_AVAILABLE = True
except ImportError:
    QUARTZ_AVAILABLE = False
    logger.warning("PyObjC Quartz not available - keystroke simulation will use AppleScript fallback")


# macOS virtual key codes for common keys
KEY_CODES = {
    'a': 0, 'b': 11, 'c': 8, 'd': 2, 'e': 14, 'f': 3, 'g': 5, 'h': 4,
    'i': 34, 'j': 38, 'k': 40, 'l': 37, 'm': 46, 'n': 45, 'o': 31, 'p': 35,
    'q': 12, 'r': 15, 's': 1, 't': 17, 'u': 32, 'v': 9, 'w': 13, 'x': 7,
    'y': 16, 'z': 6,
    '0': 29, '1': 18, '2': 19, '3': 20, '4': 21, '5': 23, '6': 22, '7': 26,
    '8': 28, '9': 25,
    ' ': 49, '\n': 36, '\t': 48,
    '-': 27, '=': 24, '[': 33, ']': 30, '\\': 42, ';': 41, "'": 39,
    ',': 43, '.': 47, '/': 44, '`': 50,
    'escape': 53, 'delete': 51, 'tab': 48, 'return': 36, 'enter': 36,
    'up': 126, 'down': 125, 'left': 123, 'right': 124,
    'f1': 122, 'f2': 120, 'f3': 99, 'f4': 118, 'f5': 96, 'f6': 97,
    'f7': 98, 'f8': 100, 'f9': 101, 'f10': 109, 'f11': 103, 'f12': 111,
}

# Shift-required characters
SHIFT_CHARS = {
    '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7',
    '*': '8', '(': '9', ')': '0', '_': '-', '+': '=', '{': '[', '}': ']',
    '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '~': '`',
}


class ActionExecutor:
    """Executes voice command actions on macOS."""
    
    def __init__(self):
        self.last_action = None
        self.action_history = []
    
    def execute(self, action: dict) -> dict:
        """
        Execute a parsed action.
        
        Args:
            action: Dict with 'action', 'data', and optionally 'confidence'
            
        Returns:
            dict: {"success": bool, "message": str, "details": ...}
        """
        action_type = action.get("action")
        data = action.get("data", {})
        
        logger.info(f"Executing: {action_type} with data: {data}")
        
        try:
            if action_type == "keystrokes":
                target_app = data.get("target_app")
                if target_app:
                    # Focus target app first, then send keystrokes
                    self._open_app(target_app)
                    time.sleep(0.3)  # Wait for app to focus
                result = self._type_keystrokes(data.get("keys", ""))
            elif action_type == "shortcut":
                target_app = data.get("target_app")
                if target_app:
                    self._open_app(target_app)
                    time.sleep(0.3)
                result = self._send_shortcut(data.get("keys", ""))
            elif action_type == "open_app":
                result = self._open_app(data.get("app", ""))
            elif action_type == "close_app":
                result = self._close_app(data.get("app", ""))
            elif action_type == "speak":
                result = self._speak(data.get("text", ""))
            else:
                result = {"success": False, "message": f"Unknown action: {action_type}"}
            
            # Track history
            self.last_action = action
            self.action_history.append({
                "action": action,
                "result": result,
                "timestamp": time.time()
            })
            if len(self.action_history) > 50:
                self.action_history.pop(0)
            
            return result
            
        except Exception as e:
            logger.error(f"Action execution error: {e}")
            return {"success": False, "message": str(e)}
    
    def _type_keystrokes(self, keys: str) -> dict:
        """Type a string of characters."""
        if not keys:
            return {"success": False, "message": "No keys to type"}
        
        # Use AppleScript directly - more reliable with accessibility permissions
        # Handle special characters
        result_parts = []
        for char in keys:
            if char == '\n':
                # Press Enter key
                script = 'tell application "System Events" to key code 36'
                try:
                    subprocess.run(["osascript", "-e", script], check=True, capture_output=True)
                    result_parts.append("Enter")
                except subprocess.CalledProcessError as e:
                    logger.error(f"Enter key failed: {e.stderr.decode()}")
            else:
                result_parts.append(char)
        
        # Type the non-special characters as a batch
        regular_chars = ''.join([c for c in keys if c != '\n'])
        if regular_chars:
            result = self._type_via_applescript(regular_chars)
            if not result["success"]:
                return result
        
        return {"success": True, "message": f"Typed: {keys.replace(chr(10), '⏎')}"}
    
    def _press_key(self, char: str, modifiers: int = 0):
        """Press a single key using Quartz."""
        if not QUARTZ_AVAILABLE:
            return
        
        # Handle shift characters
        if char in SHIFT_CHARS:
            base_char = SHIFT_CHARS[char]
            modifiers |= kCGEventFlagMaskShift
            char = base_char
        elif char.isupper():
            modifiers |= kCGEventFlagMaskShift
            char = char.lower()
        
        # Get key code
        key_code = KEY_CODES.get(char.lower())
        if key_code is None:
            logger.warning(f"Unknown key code for: {char}")
            return
        
        # Create and post key down event
        event = CGEventCreateKeyboardEvent(None, key_code, True)
        if modifiers:
            CGEventSetFlags(event, modifiers)
        CGEventPost(kCGHIDEventTap, event)
        
        # Create and post key up event
        event = CGEventCreateKeyboardEvent(None, key_code, False)
        if modifiers:
            CGEventSetFlags(event, modifiers)
        CGEventPost(kCGHIDEventTap, event)
    
    def _send_shortcut(self, shortcut: str) -> dict:
        """Send a keyboard shortcut like cmd+z."""
        if not shortcut:
            return {"success": False, "message": "No shortcut specified"}
        
        parts = shortcut.lower().split("+")
        modifiers = 0
        key = parts[-1]
        
        # Build modifiers
        for part in parts[:-1]:
            if part in ("cmd", "command"):
                modifiers |= kCGEventFlagMaskCommand if QUARTZ_AVAILABLE else 0
            elif part in ("shift",):
                modifiers |= kCGEventFlagMaskShift if QUARTZ_AVAILABLE else 0
            elif part in ("alt", "option"):
                modifiers |= kCGEventFlagMaskAlternate if QUARTZ_AVAILABLE else 0
            elif part in ("ctrl", "control"):
                modifiers |= kCGEventFlagMaskControl if QUARTZ_AVAILABLE else 0
        
        if QUARTZ_AVAILABLE:
            try:
                self._press_key(key, modifiers)
                return {"success": True, "message": f"Shortcut: {shortcut}"}
            except Exception as e:
                logger.warning(f"Quartz shortcut failed, using AppleScript: {e}")
        
        # AppleScript fallback
        return self._shortcut_via_applescript(shortcut)
    
    def _type_via_applescript(self, text: str) -> dict:
        """Type text using AppleScript (fallback)."""
        # Escape special characters for AppleScript
        escaped = text.replace('\\', '\\\\').replace('"', '\\"')
        script = f'tell application "System Events" to keystroke "{escaped}"'
        
        try:
            subprocess.run(["osascript", "-e", script], check=True, capture_output=True)
            return {"success": True, "message": f"Typed (AppleScript): {text}"}
        except subprocess.CalledProcessError as e:
            return {"success": False, "message": f"AppleScript error: {e.stderr.decode()}"}
    
    def _shortcut_via_applescript(self, shortcut: str) -> dict:
        """Send shortcut using AppleScript (fallback)."""
        parts = shortcut.lower().split("+")
        key = parts[-1]
        modifiers = [p for p in parts[:-1]]
        
        # Build AppleScript modifier string
        modifier_str = ""
        if "cmd" in modifiers or "command" in modifiers:
            modifier_str += "command down, "
        if "shift" in modifiers:
            modifier_str += "shift down, "
        if "alt" in modifiers or "option" in modifiers:
            modifier_str += "option down, "
        if "ctrl" in modifiers or "control" in modifiers:
            modifier_str += "control down, "
        
        modifier_str = modifier_str.rstrip(", ")
        
        if modifier_str:
            script = f'tell application "System Events" to keystroke "{key}" using {{{modifier_str}}}'
        else:
            script = f'tell application "System Events" to keystroke "{key}"'
        
        try:
            subprocess.run(["osascript", "-e", script], check=True, capture_output=True)
            return {"success": True, "message": f"Shortcut (AppleScript): {shortcut}"}
        except subprocess.CalledProcessError as e:
            return {"success": False, "message": f"AppleScript error: {e.stderr.decode()}"}
    
    def _open_app(self, app_name: str) -> dict:
        """Open an application."""
        if not app_name:
            return {"success": False, "message": "No app name specified"}
        
        script = f'tell application "{app_name}" to activate'
        
        try:
            subprocess.run(["osascript", "-e", script], check=True, capture_output=True)
            return {"success": True, "message": f"Opened: {app_name}"}
        except subprocess.CalledProcessError as e:
            return {"success": False, "message": f"Failed to open {app_name}: {e.stderr.decode()}"}
    
    def _close_app(self, app_name: str) -> dict:
        """Close an application."""
        if not app_name:
            # Close frontmost app
            script = 'tell application "System Events" to keystroke "q" using command down'
        else:
            script = f'tell application "{app_name}" to quit'
        
        try:
            subprocess.run(["osascript", "-e", script], check=True, capture_output=True)
            return {"success": True, "message": f"Closed: {app_name or 'frontmost app'}"}
        except subprocess.CalledProcessError as e:
            return {"success": False, "message": f"Failed to close: {e.stderr.decode()}"}
    
    def _speak(self, text: str) -> dict:
        """Speak text using macOS TTS."""
        if not text:
            return {"success": False, "message": "No text to speak"}
        
        try:
            subprocess.run(["say", text], check=True, capture_output=True)
            return {"success": True, "message": f"Spoke: {text}"}
        except subprocess.CalledProcessError as e:
            return {"success": False, "message": f"TTS error: {e.stderr.decode()}"}


# Singleton instance
_executor = None

def get_executor() -> ActionExecutor:
    """Returns the singleton ActionExecutor instance."""
    global _executor
    if _executor is None:
        _executor = ActionExecutor()
    return _executor


if __name__ == "__main__":
    # Test the executor
    logging.basicConfig(level=logging.INFO)
    
    executor = get_executor()
    
    # Test opening an app
    print("Opening Calculator...")
    result = executor.execute({"action": "open_app", "data": {"app": "Calculator"}})
    print(f"Result: {result}")
    
    time.sleep(1)
    
    # Test typing
    print("Typing '3*3'...")
    result = executor.execute({"action": "keystrokes", "data": {"keys": "3*3"}})
    print(f"Result: {result}")
    
    time.sleep(0.5)
    
    # Test Enter
    print("Pressing Enter...")
    result = executor.execute({"action": "keystrokes", "data": {"keys": "\n"}})
    print(f"Result: {result}")
