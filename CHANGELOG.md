# Changelog

All notable changes to VoiceOS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **OCR Text Targeting** (Phase 1 - Enhanced Backend)
  - macOS Vision framework OCR for text detection
  - New endpoints: `/api/click-text`, `/api/find-text`, `/api/type-at-text`, `/api/ocr-debug`
  - Menu bar focused search with 2x upscaling for small text
  - `server/ocr-service.js` - Vision OCR service
- **Hybrid Routing + UI Cache** (Phase 2)
  - `/api/hybrid-click` - Routes to cache->OCR->VLM for optimal latency
  - UI element cache with 5-minute TTL (0ms vs 3800ms OCR latency)
  - `/api/cache-stats` and `/api/cache-clear` endpoints
- **Enhanced Vision Intelligence** (Phase 3)
  - `/api/vision-click` - VLM-powered click with structured JSON output
  - `server/vision-prompts.js` - Specialized prompts for UI element detection
  - Confidence threshold (0.8) before auto-clicking
- **Safety Confirmation System** (Phase 4)
  - `/api/safety-check` - Detects destructive actions (delete, trash, format)
  - `/api/confirm` - Confirm or cancel pending actions with 60s expiry
  - Risk levels: low/medium/high

### Changed
- **google-genai Migration** - Replaced deprecated `google-generativeai` with `google-genai`
  - Updated `backend/intent_parser.py` to use new Client API
  - Updated `backend/requirements.txt` with `google-genai>=1.0.0`

### Phase 5: MVP Stability & Polish (Next Sprint) 🔜
> Backlog of WIP items to complete before Phase 6 (Android/Maestro)

#### 5.1 Performance
- [ ] **VLM Latency** - Ollama ~8.5s, target <3s. [Switch to Gemini or smaller model]
- [ ] **Click Latency** - AppleScript ~800ms, target <50ms. [Install cliclick]
- [ ] **Screenshot Resize** - 550ms with sips, target <200ms. [Use sharp.js]

#### 5.2 OCR Improvements
- [ ] **Menu Bar Detection** - Small text like "File", "Edit" not reliably detected
- [ ] OCR.space API fallback
- [ ] Tune 2x upscaling parameters

#### 5.3 Privacy/Masking
- [ ] **GDPR/PCI-DSS Text Masking** - Complete testing
- [ ] **Visual Screenshot Masking** - Face detection incomplete
- [ ] **Server-side Masking** - Menubar/dock overlays

#### 5.4 Testing & Quality
- [ ] Unit tests for safety-guard patterns
- [ ] E2E test for hybrid-click flow
- [ ] Load testing for cache performance

### Phase 6: Android/Maestro Support (Deferred)

---

## [0.3.0] - 2025-12-23 (Wake Word Customization)

### Added
- **Customizable Wake Word** - User can set a custom wake word (nickname) via voice command
  - Command: "Set nickname to [name]" or "Call me [name]"
  - Persists across sessions using `localStorage`
  - Visual feedback in VoiceOrb shows the active wake word (e.g., 'SAY "MAX"')
- **Dynamic Phonetic Variants** - LLM-powered variant generation for robust wake word detection
  - Uses Gemini to generate 5+ phonetically similar words (e.g., "Max" -> "marks", "macs", "max's")
  - Automatically handles mishearings by speech recognition
- **Wake Word Gating** - LLM commands are now gated behind the wake word
  - Prevents accidental LLM usage and reduces bandwidth costs
  - 10-second listening window after wake word detection (auto-reset to standby)
  - Visual indicator: Cyan "LISTENING..." state vs Pink "SAY [NAME]" standby state
- **New Default Wake Word**: "Ayo" (replaces "Holo")

### Changed
- **Wake Word Engine**: Switched from "Holo" to dynamic regex-based matching with "Ayo" default
- VoiceOrb: Added `wakeWord` and `isListening` props for better state visualization
- **Unified LLM Language Support**: Removed manual language switching - LLM handles any language automatically
  - Removed language flag emoji (🇺🇸/🇹🇷) from header
  - Removed `switch_language` intent handler

### Added (Multilingual)
- **Voice-based Language Switching**: Say "switch to Turkish" or "Türkçe" to change speech recognition language
  - Supports: English, Turkish, German, French, Spanish
  - Persists across sessions (localStorage)

### Removed
- Temp/debug files: `pdf_strings.txt`, `run_log.txt`, `test_backend_open.js`

### Added (Developer Tools)
- **Bandwidth Monitor** (debug mode only): Real-time ↓/↑ speed indicator
  - Color-coded: Green (OK) / Yellow (slow) / Gray (idle)
  - Fixed position at bottom-left corner
- **Unified Logging System**
  - Frontend `Logger.ts` with levels (DEBUG/INFO/WARN/ERROR)
  - Backend Python `RotatingFileHandler` (5 files × 1MB)
  - Log analysis API: `/api/logs/analyze`
  - ENV config: `VITE_LOG_LEVEL`, `LOG_LEVEL`, `LOG_DIR`
- **Usage Analytics System**
  - Tracks intent vs outcome for self-improvement
  - Managed via `VITE_ANALYTICS_ENABLED`
  - Rotated storage: `logs/analytics.jsonl`
  - Improvement suggestions API: `/api/analytics/improvements`

---

## [0.2.0] - 2025-12-22

### Added
- **Siri-Inspired UI Redesign** - Complete visual overhaul with Antigravity aesthetic
  - New `VoiceOrb` component with flowing pink/purple/blue gradient animation
  - Volume-reactive scaling effect
  - Glow pulse animations when active
  - Pulsing ring effects in Siri colors
- **Design System** - New `index.css` with comprehensive CSS utility classes
  - Siri color palette (pink #ff6b9d, purple #c084fc, blue #60a5fa)
  - `siri-gradient` animation for flowing colors
  - `glow-pulse` animation for ambient effects
  - `float` animation for subtle movement
- **Ambient Background** - Pink/purple/blue gradient orbs create depth
- **Node.js API Server** - `start.sh` now auto-starts the API server on port 3001
- **Context-Aware Voice Control** - Dynamic voice commands based on focused app
  - `context_tracker.py` - Monitors focused macOS application via PyObjC
  - `intent_parser.py` - Gemini-powered intent parsing with context awareness
  - `action_executor.py` - Executes keystrokes, shortcuts, and app commands on macOS
- **Mock Mode** - Run with `./start.sh --mock` for local testing without API key
- **Unified start.sh** - Single script to run all services
- **Turkish Command Support** - `aç` (open), `terminali` (terminal), `hesap makinesi` (calculator), `notlar` (notes)
- **Target App Focus** - Math commands (3x3, 3 by 3) auto-focus Calculator before sending keystrokes
- **Wake Word Listener** - Say "Holo" to activate voice control (requires `openwakeword`, `pyaudio`)
  - `wake_word_listener.py` - Background thread listening for wake word
  - Broadcasts `wake_word:detected` message to frontend
- **Expanded Commands** (Mock Mode):
  - Browser: new tab, close tab, refresh, go back, go forward
  - Window: minimize, full screen, hide, quit
  - System: volume up/down, mute
  - Edit: redo, cut, select all, save

### Changed
- `start_messagebus.py` - Integrates context tracking, LLM parsing, action execution, and wake word
- `requirements.txt` - Added openwakeword, pyaudio, numpy dependencies
- `action_executor.py` - Now supports volume control and `target_app` parameter
- Header, footer, and transcript colors updated to match Siri theme

### Technical Details
- New message types: `context:update`, `action:executed`, `wake_word:detected`
- Context polling: Frontend receives app focus updates every second
- Fallback parser works without Gemini API key for basic commands

---

## [0.1.0] - 2025-12-18 (Juvenile Release)

### Added
- Initial VoiceOS macOS MVP
- React frontend with voice visualization
- OVOS MessageBus backend (Python/WebSocket)
- Mock Gemini service for offline testing
- Multi-language support (English, Turkish)
- Voice command handling (open/close apps, language switching)

### Infrastructure
- Vite build system
- Playwright E2E testing
- GitHub Actions workflow

---

[Unreleased]: https://github.com/merihilgor/voiceos/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/merihilgor/voiceos/releases/tag/v0.3.0
[0.2.0]: https://github.com/merihilgor/voiceos/releases/tag/v0.2.0
[0.1.0]: https://github.com/merihilgor/voiceos/releases/tag/v0.1.0
