#!/usr/bin/env python3
"""
UI Cache - Caches UI element positions for fast repeat access.
Reduces latency for repeated clicks on the same elements.
"""

import time
import logging
from typing import Optional, Tuple, Dict

logger = logging.getLogger(__name__)


class UICache:
    """
    Caches UI element coordinates for fast repeat access.
    
    Cache key: (app_name, element_target)
    Cache value: (x, y, timestamp)
    """
    
    def __init__(self, ttl_seconds: int = 300):
        """
        Initialize UI cache.
        
        Args:
            ttl_seconds: Time-to-live for cache entries (default: 5 minutes)
        """
        self.cache: Dict[Tuple[str, str], Tuple[int, int, float]] = {}
        self.ttl = ttl_seconds
        self.hits = 0
        self.misses = 0
    
    def get(self, app_name: str, target: str) -> Optional[Tuple[int, int]]:
        """
        Get cached coordinates for an element.
        
        Args:
            app_name: Current app name (context)
            target: Element text/description
            
        Returns:
            (x, y) tuple if cached and not expired, None otherwise
        """
        key = (app_name.lower(), target.lower())
        
        if key in self.cache:
            x, y, timestamp = self.cache[key]
            if time.time() - timestamp < self.ttl:
                self.hits += 1
                logger.debug(f"[UICache] HIT: {target} in {app_name} -> ({x}, {y})")
                return (x, y)
            else:
                # Expired
                del self.cache[key]
                logger.debug(f"[UICache] EXPIRED: {target} in {app_name}")
        
        self.misses += 1
        logger.debug(f"[UICache] MISS: {target} in {app_name}")
        return None
    
    def set(self, app_name: str, target: str, x: int, y: int) -> None:
        """
        Cache coordinates for an element.
        
        Args:
            app_name: Current app name (context)
            target: Element text/description
            x: X coordinate
            y: Y coordinate
        """
        key = (app_name.lower(), target.lower())
        self.cache[key] = (x, y, time.time())
        logger.debug(f"[UICache] SET: {target} in {app_name} -> ({x}, {y})")
    
    def invalidate(self, app_name: Optional[str] = None) -> int:
        """
        Invalidate cache entries.
        
        Args:
            app_name: If provided, only invalidate entries for this app.
                     If None, invalidate all entries.
                     
        Returns:
            Number of entries invalidated
        """
        if app_name is None:
            count = len(self.cache)
            self.cache.clear()
            logger.info(f"[UICache] Invalidated all {count} entries")
            return count
        
        app_lower = app_name.lower()
        keys_to_remove = [k for k in self.cache if k[0] == app_lower]
        for key in keys_to_remove:
            del self.cache[key]
        
        logger.info(f"[UICache] Invalidated {len(keys_to_remove)} entries for {app_name}")
        return len(keys_to_remove)
    
    def stats(self) -> dict:
        """Get cache statistics."""
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0
        
        return {
            "entries": len(self.cache),
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": f"{hit_rate:.1f}%",
            "ttl_seconds": self.ttl
        }


# Singleton instance
_cache: Optional[UICache] = None


def get_ui_cache() -> UICache:
    """Get singleton UICache instance."""
    global _cache
    if _cache is None:
        _cache = UICache()
    return _cache
