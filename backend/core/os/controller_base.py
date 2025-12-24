#!/usr/bin/env python3
"""
Abstract OS Controller Base - Cross-platform interface for OS interactions.
VoiceOS VLA Agent: "The Hands"
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


@dataclass
class UIElement:
    """Represents an accessible UI element from the OS Accessibility Tree."""
    id: str                                    # Unique accessibility identifier
    label: str                                 # Human-readable label ("Submit Button")
    role: str                                  # Element role ("button", "textfield", "link")
    bounds: Tuple[int, int, int, int]          # (x, y, width, height)
    value: Optional[str] = None                # Current value (for inputs)
    enabled: bool = True                       # Is element interactable?
    focused: bool = False                      # Is element focused?
    children: List['UIElement'] = field(default_factory=list)
    
    @property
    def center(self) -> Tuple[int, int]:
        """Return center point of element for clicking."""
        x, y, w, h = self.bounds
        return (x + w // 2, y + h // 2)
    
    def __repr__(self):
        return f"UIElement(id={self.id[:20]}..., label='{self.label}', role='{self.role}')"


@dataclass
class ScreenContext:
    """Combined screen state for LLM context."""
    elements: List[UIElement]             # Parsed UI elements
    focused_element: Optional[UIElement]  # Currently focused element
    screenshot_b64: Optional[str]         # Low-res screenshot (base64 JPEG)
    window_title: str = ""                # Active window title
    app_name: str = ""                    # Active application name
    
    def to_text_list(self) -> str:
        """Convert elements to numbered text list for LLM."""
        lines = [f"Active App: {self.app_name} - {self.window_title}"]
        for i, el in enumerate(self.elements[:50], 1):  # Limit to 50 elements
            status = "[FOCUSED] " if el.focused else ""
            lines.append(f"{i}. {status}[{el.role}] {el.label}")
        return "\n".join(lines)


class AbstractController(ABC):
    """
    Abstract base class for OS-specific controllers.
    Implementations: MacOSController, WindowsController, MobileController (future)
    """
    
    @abstractmethod
    async def click(self, x: int, y: int) -> bool:
        """
        Click at screen coordinates.
        Returns True if click was executed successfully.
        """
        pass
    
    @abstractmethod
    async def double_click(self, x: int, y: int) -> bool:
        """Double-click at screen coordinates."""
        pass
    
    @abstractmethod
    async def right_click(self, x: int, y: int) -> bool:
        """Right-click at screen coordinates."""
        pass
    
    @abstractmethod
    async def scroll(self, direction: str, amount: int = 3) -> bool:
        """
        Scroll in direction ('up', 'down', 'left', 'right').
        Amount is number of scroll units.
        """
        pass
    
    @abstractmethod
    async def type_text(self, text: str) -> bool:
        """Type text string using keyboard."""
        pass
    
    @abstractmethod
    async def press_shortcut(self, shortcut: str) -> bool:
        """
        Press keyboard shortcut (e.g., 'cmd+c', 'ctrl+shift+n').
        """
        pass
    
    @abstractmethod
    async def get_ui_tree(self) -> List[UIElement]:
        """
        Get accessibility tree of current focused window.
        Returns list of UIElements with labels, roles, and bounds.
        """
        pass
    
    @abstractmethod
    async def get_focused_element(self) -> Optional[UIElement]:
        """Get currently focused UI element."""
        pass
    
    @abstractmethod
    async def get_screen_context(self) -> ScreenContext:
        """
        Get full screen context including:
        - UI element tree
        - Focused element
        - Screenshot
        - Active app/window info
        """
        pass
    
    @abstractmethod
    async def click_element(self, element: UIElement) -> bool:
        """Click on a specific UIElement by its center point."""
        pass
    
    @abstractmethod
    async def focus_element(self, element: UIElement) -> bool:
        """Focus a specific UIElement (e.g., for typing into it)."""
        pass
    
    # Utility methods (non-abstract)
    
    async def find_element_by_label(self, label: str) -> Optional[UIElement]:
        """Find element by its label (case-insensitive partial match)."""
        elements = await self.get_ui_tree()
        label_lower = label.lower()
        for el in elements:
            if label_lower in el.label.lower():
                return el
        return None
    
    async def find_element_by_role(self, role: str) -> List[UIElement]:
        """Find all elements with a specific role."""
        elements = await self.get_ui_tree()
        return [el for el in elements if el.role.lower() == role.lower()]
