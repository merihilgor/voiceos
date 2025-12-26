#!/usr/bin/env python3
"""
Hybrid Router - Routes commands to optimal execution path.
Prioritizes: Cache > OCR > VLM for best latency.
"""

import re
import logging
import requests
from dataclasses import dataclass
from typing import Optional, Tuple
from enum import Enum

from ui_cache import get_ui_cache

logger = logging.getLogger(__name__)


class ExecutionMethod(Enum):
    CACHED = "cached"      # <100ms - Use cached coordinates
    OCR = "ocr"            # <500ms - Text-based OCR targeting
    VLM = "vlm"            # ~3s    - Vision LLM for complex actions


@dataclass
class ExecutionPlan:
    """Plan for executing a voice command."""
    method: ExecutionMethod
    target: Optional[str] = None       # Text target for OCR
    coordinates: Optional[Tuple[int, int]] = None  # For cached
    utterance: Optional[str] = None    # Original for VLM


class HybridRouter:
    """
    Routes voice commands to the fastest execution path.
    
    Routing priority:
    1. Cache - If element was clicked before, use cached coords
    2. OCR - If command is "click [text]", use OCR targeting
    3. VLM - For complex actions requiring visual understanding
    """
    
    # Patterns that indicate a simple click command
    CLICK_PATTERNS = [
        r"^click\s+(?:on\s+)?(?:the\s+)?(.+)$",
        r"^tap\s+(?:on\s+)?(?:the\s+)?(.+)$",
        r"^press\s+(?:the\s+)?(.+?)(?:\s+button)?$",
        r"^select\s+(.+)$",
    ]
    
    # Words that indicate complexity (need VLM)
    COMPLEX_INDICATORS = [
        "third", "second", "first", "last", "next", "previous",
        "red", "blue", "green", "large", "small", "icon",
        "image", "picture", "photo", "logo",
    ]
    
    def __init__(self, ocr_base_url: str = "http://localhost:3001"):
        self.ocr_base_url = ocr_base_url
        self.cache = get_ui_cache()
    
    def route(self, utterance: str, app_name: str = "Unknown") -> ExecutionPlan:
        """
        Determine the best execution path for a command.
        
        Args:
            utterance: Voice command text
            app_name: Current app context
            
        Returns:
            ExecutionPlan with method and target info
        """
        lower = utterance.lower().strip()
        
        # Try to extract click target
        target = self._extract_click_target(lower)
        
        if target:
            # Check if target requires visual understanding
            if self._needs_vlm(target):
                logger.info(f"[Router] VLM needed for complex target: {target}")
                return ExecutionPlan(
                    method=ExecutionMethod.VLM,
                    utterance=utterance
                )
            
            # Level 1: Check cache first
            cached_coords = self.cache.get(app_name, target)
            if cached_coords:
                logger.info(f"[Router] CACHE HIT: {target} -> {cached_coords}")
                return ExecutionPlan(
                    method=ExecutionMethod.CACHED,
                    target=target,
                    coordinates=cached_coords
                )
            
            # Level 2: Use OCR
            logger.info(f"[Router] OCR path for: {target}")
            return ExecutionPlan(
                method=ExecutionMethod.OCR,
                target=target
            )
        
        # Level 3: Fall back to VLM for non-click commands
        logger.info(f"[Router] VLM fallback for: {utterance}")
        return ExecutionPlan(
            method=ExecutionMethod.VLM,
            utterance=utterance
        )
    
    def _extract_click_target(self, utterance: str) -> Optional[str]:
        """Extract click target from utterance."""
        for pattern in self.CLICK_PATTERNS:
            match = re.match(pattern, utterance, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None
    
    def _needs_vlm(self, target: str) -> bool:
        """Check if target requires visual understanding."""
        lower = target.lower()
        return any(indicator in lower for indicator in self.COMPLEX_INDICATORS)
    
    def execute(self, plan: ExecutionPlan, app_name: str = "Unknown") -> dict:
        """
        Execute a plan and return result.
        
        Args:
            plan: ExecutionPlan from route()
            app_name: Current app context
            
        Returns:
            {"success": bool, "message": str, "method": str}
        """
        try:
            if plan.method == ExecutionMethod.CACHED:
                return self._execute_cached(plan)
            elif plan.method == ExecutionMethod.OCR:
                return self._execute_ocr(plan, app_name)
            else:
                return self._execute_vlm(plan)
        except Exception as e:
            logger.error(f"[Router] Execution error: {e}")
            return {"success": False, "message": str(e), "method": plan.method.value}
    
    def _execute_cached(self, plan: ExecutionPlan) -> dict:
        """Execute using cached coordinates."""
        x, y = plan.coordinates
        
        # Call click API
        response = requests.post(
            f"{self.ocr_base_url}/api/click",
            json={"x": x, "y": y}
        )
        
        if response.ok:
            return {
                "success": True,
                "message": f"Clicked {plan.target} at ({x}, {y}) [CACHED]",
                "method": "cached"
            }
        return {"success": False, "message": response.text, "method": "cached"}
    
    def _execute_ocr(self, plan: ExecutionPlan, app_name: str) -> dict:
        """Execute using OCR text targeting."""
        # Call OCR click API
        response = requests.post(
            f"{self.ocr_base_url}/api/click-text",
            json={"query": plan.target}
        )
        
        result = response.json()
        
        if result.get("success"):
            # Cache the successful coordinates
            if "x" in result and "y" in result:
                x, y = result["x"], result["y"]
                self.cache.set(app_name, plan.target, x, y)
                logger.info(f"[Router] Cached: {plan.target} -> ({x}, {y})")
            
            return {
                "success": True,
                "message": f"Clicked {plan.target} via OCR",
                "method": "ocr"
            }
        
        return {
            "success": False,
            "message": result.get("error", "OCR failed"),
            "method": "ocr"
        }
    
    def _execute_vlm(self, plan: ExecutionPlan) -> dict:
        """Execute using Vision LLM."""
        # This would call the vision API
        # For now, return a placeholder
        return {
            "success": False,
            "message": "VLM execution not implemented",
            "method": "vlm"
        }


# Singleton instance
_router: Optional[HybridRouter] = None


def get_hybrid_router() -> HybridRouter:
    """Get singleton HybridRouter instance."""
    global _router
    if _router is None:
        _router = HybridRouter()
    return _router
