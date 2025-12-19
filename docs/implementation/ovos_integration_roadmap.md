# OpenVoiceOS Integration Roadmap

**Status**: Planning
**Target Architecture**: Hybrid (React Frontend + Python/OVOS Backend)

## Strategic Assessment

The `openvoiceos_integration_tech_spec.md` outlines a plan to integrate OVOS libraries.
**Current State**: The repository is a React/Node.js application (VoiceOS "Juvenile").
**Gap**: OVOS libraries (`ovos-core`, `ovos-messagebus`, etc.) are Python-based.
**Solution**: We will not "migrate" existing Node.js code to Python immediately, but rather **establish a Python backend** that runs the `ovos-core` stack. The React frontend will act as the GUI/Client, communicating with the backend via the **OVOS MessageBus (WebSockets)**.

---

## Phase 1: Foundational Stabilization (The "Python Bridge")

**Goal**: Get `ovos-core` running and talking to the React App.

### 1.1 Python Infrastructure Setup
- [ ] Create `backend/` directory.
- [ ] Initialize Python virtual environment.
- [ ] Create `requirements.txt` with `ovos-core`, `ovos-messagebus`, `ovos-utils`.
- [ ] Create `backend/start_core.py` to launch the services.

### 1.2 MessageBus Implementation
- [ ] Launch `ovos-messagebus` service.
- [ ] Verify WebSocket connectivity (default port 8181).

### 1.3 React Frontend Integration
- [ ] Install `ovos-websocket-client` (JS/TS adapter) or implement a raw WebSocket hook in React.
- [ ] Create `useMessageBus` hook in `src/hooks/useMessageBus.ts`.
- [ ] Connect `App.tsx` to the backend.
- [ ] **Verification**: Send "speak" message from React -> Backend -> OVOS processes it (logs) -> Backend sends audio/text back (eventually).

### 1.4 "Migration" (Adoption)
- [ ] Map existing frontend "Voice Capture" to send audio binaries or text transcripts to OVOS MessageBus.
- [ ] Replace direct Gemini API calls in Frontend with intent messages sent to OVOS (which then handles Gemini via a Solvers Plugin).

---

## Phase 2: Plugin Ecosystem

**Goal**: Move intelligence to the Backend.

### 2.1 Solver Plugin
- [ ] Create `ovos-solver-gemini-plugin` (Python).
- [ ] Configure `ovos-core` to use this plugin for fallback queries.

### 2.2 Audio Pipeline
- [ ] Configure `ovos-dinkum-listener` (if applicable on macOS) or maintain browser-based STT.
- [ ] Set up TTS (Text-to-Speech) to play responses.

---

## Phase 3: Hardware Abstraction (PHAL)

**Goal**: System control (Volume, App Launching).

### 3.1 macOS PHAL Plugin
- [ ] Create `ovos-phal-plugin-macos` using `pyobjc` or calling system commands (`osascript`).
- [ ] Implement Volume, Brightness, and App Launching intents.

---

## Technical Tasks (Immediate)

1.  **Initialize Backend**:
    ```bash
    mkdir backend
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install ovos-core ovos-messagebus ovos-utils
    ```
2.  **Create Frontend Hook**:
    *   Develop `useOvosConnection` to manage WebSocket state.

3.  **Verify Loop**:
    *   React sends `recognizer_loop:utterance` -> MessageBus -> OVOS Intent Service -> Log Output.

