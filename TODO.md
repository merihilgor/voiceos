# VoiceOS Development Roadmap

## Phase 1: Core Optimization (Reduce Usage & Smarter AI)
1. **[ ] Implement Wake Word Activation**
    - **Goal:** Stop "overuse of LLM" and bandwidth.
    - Restrict LLM processing to commands prefixed with "Holo".
    - Assistant remains in standby (listening locally) until wake word is detected.

2. **[ ] Unified LLM-based Language Support**
    - **Goal:** Leverage LLM intelligence/removing legacy code.
    - Remove manual language switching logic (buttons/state).
    - Allow LLM to detect language and translate it to system intents automatically.

3. **[ ] Codebase Cleanup**
    - **Goal:** Remove technical debt.
    - Remove the specific code/libraries made obsolete by Step 2 (e.g., old language switchers).
    - General cleanup of unused files.

## Phase 2: User Experience & Requirements
4. **[ ] Bandwidth Monitoring & Requirements**
    - **Goal:** Visibility for the user.
    - Implement real-time bandwidth usage indicator.
    - Add "Minimum Requirement" checks (50Mbps Down / 10Mbps Up).

## Phase 3: Infrastructure
5. **[ ] Network Layer Evaluation (Socket.io)**
    - **Goal:** Long-term stability.
    - Evaluate replacing native WebSocket with `socket.io`.
    - *Note down priority: Low, unless current WebSockets prove unstable.*
