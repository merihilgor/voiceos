#!/usr/bin/env python3
"""
Screen Capture Module - Captures screenshots for vision-based commands.
Uses PyAutoGUI for cross-platform screenshot capture.
"""

import base64
import io
import logging
import subprocess
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# Try to import PyAutoGUI for cross-platform support
try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False
    logger.warning("pyautogui not available - using macOS screencapture fallback")

# Try to import PIL for image processing
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("PIL not available - some image processing features disabled")


class ScreenCapture:
    """Captures screenshots for vision-based AI processing."""
    
    def __init__(self, max_width: int = 1920, quality: int = 85):
        """
        Initialize screen capture.
        
        Args:
            max_width: Maximum width to resize images to (for API efficiency)
            quality: JPEG quality (1-100)
        """
        self.max_width = max_width
        self.quality = quality
    
    def capture_screen(self, region: Optional[Tuple[int, int, int, int]] = None) -> Optional[str]:
        """
        Capture the full screen or a region.
        
        Args:
            region: Optional (x, y, width, height) to capture specific region
            
        Returns:
            Base64-encoded JPEG image string, or None on failure
        """
        try:
            if PYAUTOGUI_AVAILABLE:
                return self._capture_with_pyautogui(region)
            else:
                return self._capture_with_macos()
        except Exception as e:
            logger.error(f"Screen capture failed: {e}")
            return None
    
    def capture_active_window(self) -> Optional[str]:
        """
        Capture only the active/focused window.
        
        Returns:
            Base64-encoded JPEG image string, or None on failure
        """
        try:
            return self._capture_active_window_macos()
        except Exception as e:
            logger.error(f"Active window capture failed: {e}")
            # Fallback to full screen
            return self.capture_screen()
    
    def _capture_with_pyautogui(self, region: Optional[Tuple[int, int, int, int]] = None) -> str:
        """Capture using PyAutoGUI (cross-platform)."""
        screenshot = pyautogui.screenshot(region=region)
        return self._image_to_base64(screenshot)
    
    def _capture_with_macos(self) -> str:
        """Capture using macOS screencapture command."""
        import tempfile
        import os
        
        # Create temp file
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            # Capture screen to temp file
            subprocess.run(['screencapture', '-x', tmp_path], check=True)
            
            # Read and convert to base64
            with open(tmp_path, 'rb') as f:
                image_data = f.read()
            
            # Optionally resize with PIL
            if PIL_AVAILABLE:
                img = Image.open(io.BytesIO(image_data))
                return self._image_to_base64(img)
            else:
                return base64.b64encode(image_data).decode('utf-8')
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    def _capture_active_window_macos(self) -> str:
        """Capture the active window on macOS."""
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            # -l flag captures the frontmost window
            # Get the window ID of the frontmost window
            result = subprocess.run(
                ['osascript', '-e', 'tell application "System Events" to get id of first window of (first process whose frontmost is true)'],
                capture_output=True, text=True
            )
            
            if result.returncode == 0 and result.stdout.strip():
                window_id = result.stdout.strip()
                subprocess.run(['screencapture', '-x', '-l', window_id, tmp_path], check=True)
            else:
                # Fallback to interactive window selection (immediate capture)
                subprocess.run(['screencapture', '-x', '-w', tmp_path], check=True)
            
            with open(tmp_path, 'rb') as f:
                image_data = f.read()
            
            if PIL_AVAILABLE:
                img = Image.open(io.BytesIO(image_data))
                return self._image_to_base64(img)
            else:
                return base64.b64encode(image_data).decode('utf-8')
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    def _image_to_base64(self, img) -> str:
        """Convert PIL Image to base64-encoded JPEG."""
        # Resize if too large
        if img.width > self.max_width:
            ratio = self.max_width / img.width
            new_size = (self.max_width, int(img.height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # Convert to RGB if necessary (for JPEG)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Save to buffer
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=self.quality)
        buffer.seek(0)
        
        return base64.b64encode(buffer.read()).decode('utf-8')
    
    def get_screen_size(self) -> Tuple[int, int]:
        """Get screen dimensions."""
        if PYAUTOGUI_AVAILABLE:
            return pyautogui.size()
        else:
            # macOS fallback
            result = subprocess.run(
                ['system_profiler', 'SPDisplaysDataType', '-json'],
                capture_output=True, text=True
            )
            # Simplified: return common default
            return (1920, 1080)


# Singleton instance
_screen_capture = None

def get_screen_capture() -> ScreenCapture:
    """Get the singleton ScreenCapture instance."""
    global _screen_capture
    if _screen_capture is None:
        _screen_capture = ScreenCapture()
    return _screen_capture


if __name__ == "__main__":
    # Test the module
    logging.basicConfig(level=logging.INFO)
    
    sc = get_screen_capture()
    
    print("Capturing screen...")
    img_b64 = sc.capture_screen()
    if img_b64:
        print(f"Captured {len(img_b64)} bytes (base64)")
        # Save for inspection
        with open("/tmp/test_screenshot.jpg", "wb") as f:
            f.write(base64.b64decode(img_b64))
        print("Saved to /tmp/test_screenshot.jpg")
    else:
        print("Failed to capture screen")
