# Wake Word & Enhanced Commands Walkthrough

## Summary

Implemented **"Holo" wake word listener** and **expanded fallback commands** for VoiceOS.

## New Files

| File | Purpose |
|------|---------|
| `backend/wake_word_listener.py` | OpenWakeWord-based wake word detection |

## Modified Files

| File | Changes |
|------|---------|
| `docs/implementation/ovos_integration_roadmap.md` | Marked Phase 1 complete, added Phase 2 |
| `backend/intent_parser.py` | Added browser, window, system commands |
| `backend/action_executor.py` | Added volume control |
| `backend/start_messagebus.py` | Integrated wake word listener |
| `src/hooks/useMessageBus.ts` | Added `onWakeWord` callback |
| `App.tsx` | Added wake word handler |
| `backend/requirements.txt` | Added openwakeword, pyaudio, numpy |

## New Commands (Mock Mode)

| Command | Action |
|---------|--------|
| "new tab" | Cmd+T |
| "close tab" | Cmd+W |
| "refresh" | Cmd+R |
| "go back" | Cmd+[ |
| "minimize" | Cmd+M |
| "full screen" | Cmd+Ctrl+F |
| "volume up" | +10% volume |
| "mute" | Toggle mute |
| "redo" | Cmd+Shift+Z |
| "save" | Cmd+S |

## Setup

```bash
# Install system dependency (macOS)
brew install portaudio

# Install Python packages
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

## Usage

```bash
./start.sh --mock
# Try: "open calculator", "new tab", "volume up"
```

## Architecture

```mermaid
flowchart LR
    A[Microphone] --> B[Wake Word Listener]
    B -->|Holo detected| C[MessageBus]
    C -->|wake_word:detected| D[Frontend]
    D --> E[Activate Speech Recognition]
```

> **Note**: Wake word currently uses "hey_jarvis" model as placeholder. Train custom "Holo" model via [OpenWakeWord Colab](https://github.com/dscripka/openWakeWord).
