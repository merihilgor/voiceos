# OpenVoiceOS Integration Roadmap

**Status**: Phase 1 Complete ✅
**Target Architecture**: Hybrid (React Frontend + Python/OVOS Backend)

## Strategic Assessment

The `openvoiceos_integration_tech_spec.md` outlines a plan to integrate OVOS libraries.
**Current State**: The repository is a React/Node.js application (VoiceOS "Juvenile").
**Gap**: OVOS libraries (`ovos-core`, `ovos-messagebus`, etc.) are Python-based.
**Solution**: We will not "migrate" existing Node.js code to Python immediately, but rather **establish a Python backend** that runs the `ovos-core` stack. The React frontend will act as the GUI/Client, communicating with the backend via the **OVOS MessageBus (WebSockets)**.

---

## Phase 1: Foundational Stabilization (The "Python Bridge") ✅ COMPLETE

**Goal**: Get `ovos-core` running and talking to the React App.

### 1.1 Python Infrastructure Setup ✅
- [x] Create `backend/` directory.
- [x] Initialize Python virtual environment.
- [x] Create `requirements.txt` with PyObjC, google-generativeai dependencies.
- [x] Create `backend/start_messagebus.py` to launch the services.

### 1.2 MessageBus Implementation ✅
- [x] Launch WebSocket MessageBus service on port 8181.
- [x] Verify WebSocket connectivity.

### 1.3 React Frontend Integration ✅
- [x] Create `useMessageBus` hook in `src/hooks/useMessageBus.ts`.
- [x] Connect `App.tsx` to the backend.
- [x] Send `recognizer_loop:utterance` messages from React → Backend.

### 1.4 Context-Aware Voice Control ✅
- [x] `context_tracker.py` - Monitor focused macOS app.
- [x] `intent_parser.py` - Gemini-powered intent parsing with fallback.
- [x] `action_executor.py` - Execute keystrokes/shortcuts on macOS.
- [x] Map voice commands to OS actions (open apps, type, shortcuts).

---

## Phase 2: Enhanced Reliability & Wake Word ✅ COMPLETE

**Goal**: Improve voice activation and expand command support.

### 2.1 Dynamic Wake Word (Ayo/Custom) ✅
- [x] Install `openwakeword` and `pyaudio` dependencies.
- [x] Create `wake_word_listener.py` with "Ayo" detection.
- [x] **New:** Implement dynamic regex matching for custom wake words ("Set nickname to Max").
- [x] **New:** Add LLM-based variant generation for robustness.
- [x] Update frontend to handle `wake_word` state and `isListening` gating.

### 2.2 Expanded Command Library ✅
- [x] Browser commands: "new tab", "close tab", "refresh", "go back".
- [x] Window commands: "minimize", "maximize", "full screen".
- [x] System commands: "volume up/down", "mute".

### 2.3 Audio Pipeline ✅
- [x] Configure local wake word detection (OpenWakeWord).
- [x] Set up TTS (Text-to-Speech) for responses (via Gemini/Ollama).

---

## Technical Tasks (Completed)

1. **Wake Word Implementation**:
    * Implemented hybrid approach: OpenWakeWord backend + Dynamic Regex frontend.
    * Integrated Gemini LLM for generating phonetic variants of custom nicknames.

2. **Expanded Fallback Parser**:
    * Added comprehensive mock commands for browser and system control.

