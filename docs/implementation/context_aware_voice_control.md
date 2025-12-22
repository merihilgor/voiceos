# Context-Aware Voice Control System

**Status**: Design  
**Goal**: Replace static voice commands with dynamic, LLM-interpreted commands that understand application context.

---

## Overview

Instead of predefined commands like "open calculator", the system will:
1. **Track context** - Know which app is focused
2. **Interpret dynamically** - Use Gemini to understand ANY utterance in context
3. **Execute actions** - Send keystrokes, clicks, or system commands

### Example Flow

```
User: "Open Calculator"     → Opens Calculator app, sets context
User: "3 by 3"              → Sends keystrokes "3*3" to Calculator
User: "equals"              → Sends Enter key
User: "clear"               → Sends Cmd+A, Delete
User: "Open Notes"          → Opens Notes, changes context
User: "write hello world"   → Types "hello world" in Notes
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ Voice Input │→ │ Context View │  │ Action Feedback   │   │
│  └─────────────┘  └──────────────┘  └───────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ WebSocket (8181)
┌──────────────────────────▼──────────────────────────────────┐
│                    OVOS MessageBus                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ Context Tracker │  │ LLM Intent      │  │ Action      │  │
│  │ (Focused App)   │  │ Parser (Gemini) │  │ Executor    │  │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘  │
│           │                    │                   │         │
│           └────────────────────┴───────────────────┘         │
└──────────────────────────┬──────────────────────────────────┘
                           │ AppleScript / PyObjC
┌──────────────────────────▼──────────────────────────────────┐
│                        macOS                                 │
│  • Get focused app (NSWorkspace)                            │
│  • Send keystrokes (CGEventPost)                            │
│  • Execute commands (osascript)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Context Tracker

Continuously monitors which application has focus.

**File**: `backend/context_tracker.py`

```python
# Uses PyObjC to get active app
from AppKit import NSWorkspace

def get_focused_app() -> dict:
    """Returns current focused application info."""
    workspace = NSWorkspace.sharedWorkspace()
    active_app = workspace.frontmostApplication()
    return {
        "name": active_app.localizedName(),
        "bundle_id": active_app.bundleIdentifier(),
        "pid": active_app.processIdentifier()
    }
```

---

### 2. LLM Intent Parser

Uses Gemini to interpret utterances based on current context.

**File**: `backend/intent_parser.py`

**System Prompt**:
```
You are a voice command interpreter for macOS. Given:
- Current focused app: {app_name}
- User utterance: "{utterance}"

Respond with JSON action:
{
  "action": "keystrokes" | "shortcut" | "open_app" | "close_app" | "speak",
  "data": { ... }
}

Examples:
- "3 by 3" in Calculator → {"action": "keystrokes", "data": {"keys": "3*3"}}
- "equals" in Calculator → {"action": "keystrokes", "data": {"keys": "\\n"}}
- "undo" in any app → {"action": "shortcut", "data": {"keys": "cmd+z"}}
- "open notes" → {"action": "open_app", "data": {"app": "Notes"}}
```

---

### 3. Action Executor

Executes the parsed actions on macOS.

**File**: `backend/action_executor.py`

| Action | Implementation |
|--------|----------------|
| `keystrokes` | CGEventPost to type characters |
| `shortcut` | CGEventPost with modifier keys |
| `open_app` | `osascript -e 'tell application "X" to activate'` |
| `close_app` | `osascript -e 'tell application "X" to quit'` |
| `speak` | TTS response to user |

---

### 4. Updated MessageBus Flow

**File**: `backend/start_messagebus.py` (enhanced)

```python
async def handle_message(websocket, message):
    data = json.loads(message)
    
    if data['type'] == 'recognizer_loop:utterance':
        utterance = data['data']['utterances'][0]
        
        # 1. Get current context
        context = context_tracker.get_focused_app()
        
        # 2. Parse with LLM
        action = await intent_parser.parse(utterance, context)
        
        # 3. Execute action
        result = action_executor.execute(action)
        
        # 4. Send result back to frontend
        await websocket.send(json.dumps({
            'type': 'action:executed',
            'data': {
                'action': action,
                'result': result,
                'context': context
            }
        }))
```

---

## Message Types

| Message | Direction | Purpose |
|---------|-----------|---------|
| `recognizer_loop:utterance` | Frontend → Backend | Voice input |
| `context:update` | Backend → Frontend | Current focused app |
| `action:executed` | Backend → Frontend | Confirmation of action |
| `speak` | Backend → Frontend | TTS response |

---

## Implementation Roadmap

### Phase 1: Core Infrastructure
- [ ] `context_tracker.py` - Get focused app
- [ ] `intent_parser.py` - Gemini integration with context
- [ ] `action_executor.py` - Keystroke/command execution

### Phase 2: Integration
- [ ] Update `start_messagebus.py` with new flow
- [ ] Update frontend to show context and actions

### Phase 3: Refinement
- [ ] Handle edge cases (no app focused, unknown actions)
- [ ] Add common shortcuts library
- [ ] Caching/optimization for LLM calls

---

## Dependencies

```txt
# backend/requirements.txt (additions)
pyobjc-framework-Cocoa    # For NSWorkspace (context tracking)
pyobjc-framework-Quartz   # For CGEventPost (keystrokes)
google-generativeai       # Gemini API
```

---

## Security Considerations

> [!CAUTION]
> This system can execute arbitrary keystrokes and commands. Consider:
> - User confirmation for destructive actions
> - Allowlist of permitted applications
> - Rate limiting on command execution
