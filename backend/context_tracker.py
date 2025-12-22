#!/usr/bin/env python3
"""
Context Tracker - Monitors which macOS application has focus.
Uses PyObjC to access NSWorkspace for real-time app tracking.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Try to import PyObjC (macOS only)
try:
    from AppKit import NSWorkspace
    PYOBJC_AVAILABLE = True
except ImportError:
    PYOBJC_AVAILABLE = False
    logger.warning("PyObjC not available - context tracking will use mock data")


class ContextTracker:
    """Tracks the currently focused application on macOS."""
    
    def __init__(self):
        self._last_app = None
        self._context_history = []
    
    def get_focused_app(self) -> dict:
        """
        Returns information about the currently focused application.
        
        Returns:
            dict: {
                "name": "Calculator",
                "bundle_id": "com.apple.calculator",
                "pid": 12345
            }
        """
        if not PYOBJC_AVAILABLE:
            # Mock data for non-macOS or missing PyObjC
            return {
                "name": "Mock App",
                "bundle_id": "com.mock.app",
                "pid": 0
            }
        
        try:
            workspace = NSWorkspace.sharedWorkspace()
            active_app = workspace.frontmostApplication()
            
            app_info = {
                "name": active_app.localizedName(),
                "bundle_id": active_app.bundleIdentifier(),
                "pid": active_app.processIdentifier()
            }
            
            # Track context changes
            if self._last_app != app_info["name"]:
                self._context_history.append(app_info)
                if len(self._context_history) > 10:
                    self._context_history.pop(0)
                self._last_app = app_info["name"]
                logger.info(f"Context changed to: {app_info['name']}")
            
            return app_info
            
        except Exception as e:
            logger.error(f"Error getting focused app: {e}")
            return {
                "name": "Unknown",
                "bundle_id": None,
                "pid": None
            }
    
    def get_context_history(self) -> list:
        """Returns the history of focused apps (last 10)."""
        return self._context_history.copy()
    
    def get_app_type(self) -> str:
        """
        Returns a category for the current app to help with intent parsing.
        
        Returns:
            str: One of 'calculator', 'text_editor', 'browser', 'terminal', 'other'
        """
        app = self.get_focused_app()
        name = app["name"].lower()
        bundle = (app.get("bundle_id") or "").lower()
        
        # Calculator apps
        if "calculator" in name or "calc" in bundle:
            return "calculator"
        
        # Text editors / Notes
        if any(x in name for x in ["notes", "textedit", "word", "pages", "sublime", "code", "vim"]):
            return "text_editor"
        
        # Browsers
        if any(x in name for x in ["safari", "chrome", "firefox", "edge", "brave", "arc"]):
            return "browser"
        
        # Terminal
        if any(x in name for x in ["terminal", "iterm", "warp", "alacritty"]):
            return "terminal"
        
        return "other"


# Singleton instance
_tracker = None

def get_tracker() -> ContextTracker:
    """Returns the singleton ContextTracker instance."""
    global _tracker
    if _tracker is None:
        _tracker = ContextTracker()
    return _tracker


if __name__ == "__main__":
    # Test the tracker
    logging.basicConfig(level=logging.INFO)
    tracker = get_tracker()
    
    import time
    print("Monitoring focused apps... (Ctrl+C to stop)")
    try:
        while True:
            app = tracker.get_focused_app()
            app_type = tracker.get_app_type()
            print(f"Focused: {app['name']} ({app_type})")
            time.sleep(2)
    except KeyboardInterrupt:
        print("\nStopped.")
