#!/usr/bin/env python3
"""
UI Labeler - Implements Set-of-Marks (SoM) algorithm for UI element labeling.
VoiceOS VLA Agent: "The Eyes" - Visual Overlay

Adds numbered labels to screenshots so LLM can reference elements by number.
"""

import base64
import io
import logging
from typing import List, Dict, Tuple, Optional

logger = logging.getLogger(__name__)

# Try to import PIL
try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("PIL not available - SoM labeling disabled")


class UILabeler:
    """
    Adds Set-of-Marks (SoM) labels to screenshots.
    
    Each interactive UI element gets a numbered marker overlay,
    making it easy for the LLM to say "click element 5".
    """
    
    def __init__(self):
        self.label_color = (255, 100, 100)  # Red
        self.label_bg = (50, 50, 50, 200)   # Dark semi-transparent
        self.font_size = 14
        self._font = None
    
    def _get_font(self):
        """Get font for labels."""
        if self._font is None:
            try:
                # Try to use a system font
                self._font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", self.font_size)
            except:
                try:
                    self._font = ImageFont.truetype("/System/Library/Fonts/SFNSText.ttf", self.font_size)
                except:
                    self._font = ImageFont.load_default()
        return self._font
    
    def add_labels_to_screenshot(
        self, 
        screenshot_b64: str, 
        elements: List,
        max_labels: int = 40
    ) -> str:
        """
        Add numbered labels to screenshot at element positions.
        
        Args:
            screenshot_b64: Base64-encoded screenshot
            elements: List of UIElement objects with bounds
            max_labels: Maximum number of labels to add
            
        Returns:
            Base64-encoded labeled screenshot
        """
        if not PIL_AVAILABLE:
            logger.warning("PIL not available, returning original screenshot")
            return screenshot_b64
        
        try:
            # Decode screenshot
            img_data = base64.b64decode(screenshot_b64)
            img = Image.open(io.BytesIO(img_data))
            
            # Create drawing context
            draw = ImageDraw.Draw(img, 'RGBA')
            font = self._get_font()
            
            # Add labels for each element
            for i, el in enumerate(elements[:max_labels], 1):
                x, y, w, h = el.bounds
                if w <= 0 or h <= 0:
                    continue
                
                # Calculate label position (top-left corner of element)
                label_x = x
                label_y = y - 18  # Above element
                if label_y < 0:
                    label_y = y + 2  # Inside element if no room above
                
                label_text = str(i)
                
                # Draw label background
                bbox = font.getbbox(label_text)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]
                
                padding = 3
                bg_rect = [
                    label_x - padding,
                    label_y - padding,
                    label_x + text_width + padding * 2,
                    label_y + text_height + padding * 2
                ]
                draw.rectangle(bg_rect, fill=self.label_bg)
                
                # Draw label text
                draw.text((label_x, label_y), label_text, fill=self.label_color, font=font)
                
                # Draw element border (subtle highlight)
                draw.rectangle([x, y, x + w, y + h], outline=(255, 100, 100, 100), width=1)
            
            # Convert back to base64
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=85)
            buffer.seek(0)
            
            return base64.b64encode(buffer.read()).decode('utf-8')
            
        except Exception as e:
            logger.error(f"Failed to add labels: {e}")
            return screenshot_b64
    
    def create_grid_overlay(
        self, 
        screenshot_b64: str,
        grid_size: int = 100
    ) -> str:
        """
        Add coordinate grid overlay to screenshot.
        Useful for LLM to reference specific screen positions.
        
        Args:
            screenshot_b64: Base64-encoded screenshot
            grid_size: Size of grid cells in pixels
            
        Returns:
            Base64-encoded gridded screenshot
        """
        if not PIL_AVAILABLE:
            return screenshot_b64
        
        try:
            img_data = base64.b64decode(screenshot_b64)
            img = Image.open(io.BytesIO(img_data))
            draw = ImageDraw.Draw(img, 'RGBA')
            font = self._get_font()
            
            width, height = img.size
            grid_color = (128, 128, 128, 80)
            text_color = (200, 200, 200)
            
            # Draw vertical lines
            for x in range(0, width, grid_size):
                draw.line([(x, 0), (x, height)], fill=grid_color, width=1)
                draw.text((x + 2, 2), str(x), fill=text_color, font=font)
            
            # Draw horizontal lines
            for y in range(0, height, grid_size):
                draw.line([(0, y), (width, y)], fill=grid_color, width=1)
                draw.text((2, y + 2), str(y), fill=text_color, font=font)
            
            # Convert back to base64
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=85)
            buffer.seek(0)
            
            return base64.b64encode(buffer.read()).decode('utf-8')
            
        except Exception as e:
            logger.error(f"Failed to create grid: {e}")
            return screenshot_b64


# Singleton
_labeler: Optional[UILabeler] = None


def get_ui_labeler() -> UILabeler:
    """Get singleton UILabeler instance."""
    global _labeler
    if _labeler is None:
        _labeler = UILabeler()
    return _labeler
