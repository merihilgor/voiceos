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
4. **[x] Bandwidth Monitoring & Requirements**
    - **Goal:** Visibility for developers (debug mode only).
    - ✅ Real-time bandwidth indicator (shown only when `VITE_DEBUG=true`)
    - ✅ Shows ↓ Download / ↑ Upload speeds with color coding

## Phase 3: Infrastructure
5. **[~] Network Layer Evaluation (Socket.io)** - *DEFERRED*
    - **Goal:** Long-term stability.
    - ✅ Evaluated: Native WebSocket is sufficient for local communication
    - Revisit if remote server support or stability issues arise

## Phase 4: Developer Experience
6. **[x] Unified Logging System**
    - **Goal:** Best-practice logging with persistence.
    - ✅ Frontend `Logger.ts` with log levels (DEBUG/INFO/WARN/ERROR)
    - ✅ Backend Python `RotatingFileHandler` (5 files × 1MB)
    - ✅ ENV config: `VITE_LOG_LEVEL`, `LOG_LEVEL`, `LOG_DIR`
    - ✅ Log analysis API: `/api/logs/analyze`

7. **[~] Usage Analytics System** - *DRAFT / INCOMPLETE*
    - **Goal:** Track intent vs outcome for self-improvement.
    - ⚠️ **Known Issues (data not reliable):**
        - Voice capture may record mistaken/unintended audio
        - Action success/failure logging may not reflect real outcomes
        - Some failed actions logged as successful and vice versa
    - ✅ `Analytics.ts` tracks utterance → parsed intent → action → outcome
    - ✅ Enable via `VITE_ANALYTICS_ENABLED=true`
    - ✅ Log rotation for `analytics.jsonl` (5 files × 1MB)
    - ✅ Self-improvement API: `/api/analytics/improvements`
    - 🔧 TODO: Fix data accuracy before using for analysis

## Phase 5: Packaging & Distribution
8. **[ ] macOS .app Bundle & .dmg Packaging**
    - **Goal:** Distribute VoiceOS as a native macOS app.
    - **Single Instance (native approach):**
        - Add `LSMultipleInstancesProhibited = true` in Info.plist
        - macOS will auto-bring existing window to front
    - **Packaging options:**
        - Electron: `electron-builder` with `app.requestSingleInstanceLock()`
        - Native: Create .app bundle with shell launcher
        - Tauri: Rust-based, lighter than Electron
    - **Distribution:**
        - Code signing with Apple Developer ID
        - Notarization for Gatekeeper
        - Create .dmg installer with background image

