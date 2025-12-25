#!/usr/bin/env python3
"""
Intent Parser - Uses LLM to interpret voice commands in context.
Converts natural language utterances into structured actions.

Supports multiple providers:
- Gemini (Google): Set LLM_PROVIDER=gemini and GEMINI_API_KEY
- Ollama Cloud: Set LLM_PROVIDER=ollama and OLLAMA_API_KEY
"""

import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Try to import Google GenAI SDK (new unified SDK)
try:
    from google import genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    logger.warning("google-genai not available")

# Try to import OpenAI (for Ollama compatibility)
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("openai not available - Ollama support disabled")


# Default configuration
DEFAULT_OLLAMA_BASE_URL = "https://ollama.com/v1"
DEFAULT_OLLAMA_MODEL = "gemini-3-flash-preview"
DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview"


# System prompt for LLM
SYSTEM_PROMPT = """You are a voice command interpreter for macOS. Your job is to convert natural language into structured actions.

Given:
- Current focused app: {app_name} (type: {app_type})
- User utterance: "{utterance}"

Respond with ONLY a JSON object (no markdown, no explanation):

{{
  "action": "<action_type>",
  "data": {{ ... }},
  "confidence": 0.0-1.0
}}

Action types and their data:

1. "keystrokes" - Type characters
   {{"action": "keystrokes", "data": {{"keys": "text to type"}}, "confidence": 0.9}}
   
2. "shortcut" - Keyboard shortcut (use + separator)
   {{"action": "shortcut", "data": {{"keys": "cmd+z"}}, "confidence": 0.9}}
   
3. "open_app" - Open an application
   {{"action": "open_app", "data": {{"app": "Calculator"}}, "confidence": 0.95}}
   
4. "close_app" - Close an application
   {{"action": "close_app", "data": {{"app": "Calculator"}}, "confidence": 0.9}}
   
5. "speak" - Respond to user (for questions/unclear commands)
   {{"action": "speak", "data": {{"text": "I'm not sure what you mean"}}, "confidence": 0.5}}

Context-specific examples:

Calculator:
- "3 by 3" → {{"action": "keystrokes", "data": {{"keys": "3*3"}}, "confidence": 0.95}}
- "equals" or "result" → {{"action": "keystrokes", "data": {{"keys": "\\n"}}, "confidence": 0.9}}
- "plus 5" → {{"action": "keystrokes", "data": {{"keys": "+5"}}, "confidence": 0.9}}
- "clear" → {{"action": "shortcut", "data": {{"keys": "cmd+a"}}, "confidence": 0.85}}

Text Editor/Notes:
- "write hello world" → {{"action": "keystrokes", "data": {{"keys": "hello world"}}, "confidence": 0.9}}
- "new line" → {{"action": "keystrokes", "data": {{"keys": "\\n"}}, "confidence": 0.9}}
- "undo" → {{"action": "shortcut", "data": {{"keys": "cmd+z"}}, "confidence": 0.95}}
- "select all" → {{"action": "shortcut", "data": {{"keys": "cmd+a"}}, "confidence": 0.95}}
- "copy" → {{"action": "shortcut", "data": {{"keys": "cmd+c"}}, "confidence": 0.95}}
- "paste" → {{"action": "shortcut", "data": {{"keys": "cmd+v"}}, "confidence": 0.95}}

Browser:
- "new tab" → {{"action": "shortcut", "data": {{"keys": "cmd+t"}}, "confidence": 0.95}}
- "close tab" → {{"action": "shortcut", "data": {{"keys": "cmd+w"}}, "confidence": 0.95}}
- "go back" → {{"action": "shortcut", "data": {{"keys": "cmd+["}}, "confidence": 0.9}}
- "refresh" → {{"action": "shortcut", "data": {{"keys": "cmd+r"}}, "confidence": 0.95}}

Global (any app):
- "open calculator" → {{"action": "open_app", "data": {{"app": "Calculator"}}, "confidence": 0.95}}
- "open notes" → {{"action": "open_app", "data": {{"app": "Notes"}}, "confidence": 0.95}}
- "open safari" → {{"action": "open_app", "data": {{"app": "Safari"}}, "confidence": 0.95}}
- "close this" → {{"action": "shortcut", "data": {{"keys": "cmd+q"}}, "confidence": 0.8}}

CRITICAL: Output ONLY the JSON object. No explanation, no markdown formatting."""


class IntentParser:
    """Parses voice utterances into structured actions using LLM (Gemini or Ollama)."""
    
    def __init__(self, api_key: Optional[str] = None):
        # Determine provider from environment
        self.provider = os.environ.get("LLM_PROVIDER", "gemini").lower()
        self.model_name = os.environ.get("LLM_MODEL")
        self.model = None
        self.client = None
        
        logger.info(f"Initializing IntentParser with provider: {self.provider}")
        
        if self.provider == "ollama":
            self._init_ollama()
        else:
            # Default to Gemini
            self._init_gemini(api_key)
    
    def _init_gemini(self, api_key: Optional[str] = None):
        """Initialize Gemini provider using new google-genai SDK."""
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.model_name = self.model_name or DEFAULT_GEMINI_MODEL
        
        if GENAI_AVAILABLE and self.api_key:
            try:
                # New SDK uses Client object
                self.client = genai.Client(api_key=self.api_key)
                self.model = self.model_name  # Store model name for later use
                logger.info(f"Gemini client initialized with model: {self.model_name}")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini: {e}")
    
    def _init_ollama(self):
        """Initialize Ollama provider using OpenAI-compatible API."""
        ollama_api_key = os.environ.get("OLLAMA_API_KEY", "ollama")
        ollama_base_url = os.environ.get("OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL)
        self.model_name = self.model_name or DEFAULT_OLLAMA_MODEL
        
        if OPENAI_AVAILABLE and ollama_api_key:
            try:
                self.client = OpenAI(
                    api_key=ollama_api_key,
                    base_url=ollama_base_url
                )
                logger.info(f"Ollama client initialized: {ollama_base_url} with model {self.model_name}")
            except Exception as e:
                logger.error(f"Failed to initialize Ollama: {e}")

    
    async def parse(self, utterance: str, context: dict) -> dict:
        """
        Parse an utterance in the given context.
        
        Args:
            utterance: The voice command text
            context: Dict with 'name', 'bundle_id', 'pid' from context tracker
            
        Returns:
            dict: {
                "action": "keystrokes" | "shortcut" | "open_app" | "close_app" | "speak",
                "data": { ... },
                "confidence": 0.0-1.0
            }
        """
        app_name = context.get("name", "Unknown")
        app_type = context.get("type", "other")
        
        # When any LLM provider is configured, the frontend handles intent parsing
        # Skip backend parsing to avoid duplicate processing
        # Only use backend parsing when no provider is set (fallback mode)
        if self.provider:  # Any provider: gemini, ollama, openai, etc.
            logger.info(f"Skipping backend parsing - frontend {self.provider} handles intent")
            return {
                "action": "noop",
                "data": {"reason": f"Frontend {self.provider} handles intent parsing"},
                "confidence": 1.0
            }
        
        # Check if we have any LLM available
        if not self.model and not self.client:
            return self._parse_fallback(utterance, app_name, app_type)
        
        try:
            prompt = SYSTEM_PROMPT.format(
                app_name=app_name,
                app_type=app_type,
                utterance=utterance
            )
            
            # Use appropriate provider
            if self.provider == "ollama" and self.client:
                text = await self._parse_with_ollama(prompt)
            elif self.model:
                text = await self._parse_with_gemini(prompt)
            else:
                return self._parse_fallback(utterance, app_name, app_type)
            
            # Clean up response (remove markdown if present)
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
                text = text.rsplit("```", 1)[0]
            
            result = json.loads(text)
            logger.info(f"{self.provider.upper()} parsed: {utterance} → {result}")
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            return self._parse_fallback(utterance, app_name, app_type)
        except Exception as e:
            logger.error(f"LLM parse error: {e}")
            return self._parse_fallback(utterance, app_name, app_type)
    
    async def _parse_with_gemini(self, prompt: str) -> str:
        """Generate response using Gemini (new google-genai SDK)."""
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt
        )
        return response.text.strip()
    
    async def _parse_with_ollama(self, prompt: str) -> str:
        """Generate response using Ollama (OpenAI-compatible API)."""
        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,  # Low temperature for consistent JSON output
            max_tokens=500
        )
        return response.choices[0].message.content.strip()
    
    def _parse_fallback(self, utterance: str, app_name: str, app_type: str) -> dict:
        """Rule-based fallback parser when Gemini is unavailable."""
        lower = utterance.lower()
        import re
        
        # Wake word detection - "Ayo" often misheard as these
        # Only trigger if it's standalone or followed by action words
        wake_word_variants = ["ayo", "hey yo", "a yo", "aio", "io"]
        action_words = ["open", "close", "play", "stop", "new", "go", "show", "start"]
        
        stripped = lower.strip()
        for variant in wake_word_variants:
            if stripped == variant:
                # Just the wake word alone
                return {
                    "action": "speak",
                    "data": {"text": "I'm here! What would you like me to do?"},
                    "confidence": 0.95,
                    "is_wake_word": True
                }
            elif stripped.startswith(variant + " "):
                # Wake word + command - strip wake word and continue processing
                remaining = stripped[len(variant):].strip()
                if remaining:
                    # Recursively parse the command part
                    return self._parse_fallback(remaining, app_name, app_type)
        
        # Standalone app names (without "open") - for quick commands
        standalone_apps = {
            "calculator": "Calculator",
            "terminal": "Terminal",
            "safari": "Safari",
            "notes": "Notes",
            "finder": "Finder",
            "chrome": "Google Chrome",
        }
        if stripped in standalone_apps:
            return {
                "action": "open_app",
                "data": {"app": standalone_apps[stripped]},
                "confidence": 0.85
            }
        
        # App launching/closing (highest priority)
        if "open" in lower or "aç" in lower:  # Turkish: aç = open
            # Handle singular/plural and common variations (English + Turkish)
            app_mappings = {
                "calculator": "Calculator",
                "calc": "Calculator",
                "hesap makinesi": "Calculator",  # Turkish
                "hesap": "Calculator",  # Turkish short
                "note": "Notes",
                "notes": "Notes",
                "notlar": "Notes",  # Turkish
                "safari": "Safari",
                "browser": "Safari",
                "tarayıcı": "Safari",  # Turkish
                "terminal": "Terminal",
                "terminali": "Terminal",  # Turkish with suffix
                "finder": "Finder",
                "chrome": "Google Chrome",
            }
            for keyword, app in app_mappings.items():
                if keyword in lower:
                    return {
                        "action": "open_app",
                        "data": {"app": app},
                        "confidence": 0.9
                    }
        
        if "close" in lower:
            return {
                "action": "shortcut",
                "data": {"keys": "cmd+q"},
                "confidence": 0.8
            }
        
        # GLOBAL: Recognize math expressions anywhere
        # Pattern: "3x3", "3*3", "X by Y", "X times Y", etc.
        
        # Check for "NxN" or "N*N" format (e.g., "3x3", "3*3")
        math_match = re.match(r'^(\d+)\s*[x*×]\s*(\d+)$', lower.strip())
        if math_match:
            n1, n2 = math_match.groups()
            return {
                "action": "keystrokes",
                "data": {"keys": f"{n1}*{n2}\n", "target_app": "Calculator"},
                "confidence": 0.9
            }
        
        # Pattern: "X by Y", "X times Y", "X multiply Y"
        if any(x in lower for x in ["by", "times", "multiply", "çarpı", "kere"]):  # Turkish: çarpı/kere = times
            nums = re.findall(r'\d+', lower)
            if len(nums) >= 2:
                return {
                    "action": "keystrokes",
                    "data": {"keys": f"{nums[0]}*{nums[1]}", "target_app": "Calculator"},
                    "confidence": 0.85
                }
        
        # GLOBAL: "equals" or "result" - common after math
        if any(x in lower for x in ["equals", "result", "enter"]):
            return {
                "action": "keystrokes",
                "data": {"keys": "\n"},
                "confidence": 0.9
            }
        
        # GLOBAL: Plus operations
        if "plus" in lower:
            nums = re.findall(r'\d+', lower)
            if nums:
                return {
                    "action": "keystrokes",
                    "data": {"keys": f"+{nums[0]}"},
                    "confidence": 0.85
                }
        
        # GLOBAL: Minus operations
        if "minus" in lower:
            nums = re.findall(r'\d+', lower)
            if nums:
                return {
                    "action": "keystrokes",
                    "data": {"keys": f"-{nums[0]}"},
                    "confidence": 0.85
                }
        
        # GLOBAL: Clear
        if "clear" in lower:
            return {
                "action": "shortcut",
                "data": {"keys": "cmd+a"},
                "confidence": 0.8
            }
        
        # GLOBAL: Undo/Copy/Paste/Cut/Select All work everywhere
        if "undo" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+z"}, "confidence": 0.95}
        if "redo" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+shift+z"}, "confidence": 0.95}
        if "copy" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+c"}, "confidence": 0.95}
        if "paste" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+v"}, "confidence": 0.95}
        if "cut" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+x"}, "confidence": 0.95}
        if "select all" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+a"}, "confidence": 0.95}
        if "save" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+s"}, "confidence": 0.95}
        
        # GLOBAL: Browser commands (work in any browser)
        if "new tab" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+t"}, "confidence": 0.95}
        if "close tab" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+w"}, "confidence": 0.95}
        if "refresh" in lower or "reload" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+r"}, "confidence": 0.95}
        if "go back" in lower or "back" == lower.strip():
            return {"action": "shortcut", "data": {"keys": "cmd+["}, "confidence": 0.90}
        if "go forward" in lower or "forward" == lower.strip():
            return {"action": "shortcut", "data": {"keys": "cmd+]"}, "confidence": 0.90}
        if "new window" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+n"}, "confidence": 0.95}
        
        # GLOBAL: Window management
        if "minimize" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+m"}, "confidence": 0.95}
        if "full screen" in lower or "fullscreen" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+ctrl+f"}, "confidence": 0.90}
        if "hide" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+h"}, "confidence": 0.90}
        if "quit" in lower:
            return {"action": "shortcut", "data": {"keys": "cmd+q"}, "confidence": 0.95}
        
        # GLOBAL: System volume commands
        if "volume up" in lower or "louder" in lower:
            return {"action": "volume", "data": {"direction": "up"}, "confidence": 0.90}
        if "volume down" in lower or "quieter" in lower:
            return {"action": "volume", "data": {"direction": "down"}, "confidence": 0.90}
        if "mute" in lower:
            return {"action": "volume", "data": {"direction": "mute"}, "confidence": 0.90}
        
        # Text editor context
        if app_type == "text_editor":
            if any(x in lower for x in ["write", "type"]):
                for prefix in ["write ", "type "]:
                    if prefix in lower:
                        text = lower.split(prefix, 1)[1]
                        return {
                            "action": "keystrokes",
                            "data": {"keys": text},
                            "confidence": 0.85
                        }
        
        # Unknown command
        return {
            "action": "speak",
            "data": {"text": f"I'm not sure how to handle '{utterance}' in {app_name}"},
            "confidence": 0.3
        }


# Singleton instance
_parser = None

def get_parser(api_key: Optional[str] = None) -> IntentParser:
    """Returns the singleton IntentParser instance."""
    global _parser
    if _parser is None:
        _parser = IntentParser(api_key)
    return _parser


if __name__ == "__main__":
    # Test the parser
    import asyncio
    logging.basicConfig(level=logging.INFO)
    
    parser = get_parser()
    
    test_cases = [
        ("3 by 3", {"name": "Calculator", "type": "calculator"}),
        ("equals", {"name": "Calculator", "type": "calculator"}),
        ("open notes", {"name": "Finder", "type": "other"}),
        ("write hello world", {"name": "Notes", "type": "text_editor"}),
    ]
    
    async def run_tests():
        for utterance, context in test_cases:
            result = await parser.parse(utterance, context)
            print(f"'{utterance}' in {context['name']} → {result}")
    
    asyncio.run(run_tests())
