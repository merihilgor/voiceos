# VoiceOS Development Roadmap

## Phase 1: Core Optimization (Reduce Usage & Smarter AI)
1. **[x] Implement Wake Word Activation**
    - **Goal:** Stop "overuse of LLM" and bandwidth.
    - Restrict LLM processing to commands prefixed with wake word (default: "Ayo").
    - Assistant remains in standby (listening locally) until wake word is detected.
    - ✅ *Customizable via voice: "Set nickname to [word]" or "Call me [word]"*

2. **[x] Unified LLM-based Language Support**
    - **Goal:** Leverage LLM intelligence/removing legacy code.
    - ✅ LLM detects language and translates to system intents automatically.
    - ✅ Voice command: "Switch to Turkish/English" or just "Türkçe"

3. **[x] Codebase Cleanup**
    - **Goal:** Remove technical debt.
    - ✅ Removed temp files: `pdf_strings.txt`, `run_log.txt`, `test_backend_open.js`
    - ✅ All services verified in use

## Phase 2: User Experience & Requirements 
4. **[ ] Bandwidth Monitoring & Requirements**
    - **Goal:** Visibility for developers (debug mode only).
    - Implement real-time bandwidth usage indicator (shown only when `VITE_DEBUG=true`).
    - Add "Minimum Requirement" checks (50Mbps Down / 10Mbps Up).

## Phase 3: Infrastructure
5. **[ ] Network Layer Evaluation (Socket.io)**
    - **Goal:** Long-term stability.
    - Evaluate replacing native WebSocket with `socket.io`.
    - *Note down priority: Low, unless current WebSockets prove unstable.*
