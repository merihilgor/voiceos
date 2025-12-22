# Changelog

All notable changes to VoiceOS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Context-Aware Voice Control** - Dynamic voice commands based on focused app
  - `context_tracker.py` - Monitors focused macOS application via PyObjC
  - `intent_parser.py` - Gemini-powered intent parsing with context awareness
  - `action_executor.py` - Executes keystrokes, shortcuts, and app commands on macOS
- **Mock Mode** - Run with `./start.sh --mock` for local testing without API key
- **Unified start.sh** - Single script to run all services
- **Turkish Command Support** - `aç` (open), `terminali` (terminal), `hesap makinesi` (calculator), `notlar` (notes)
- **Target App Focus** - Math commands (3x3, 3 by 3) auto-focus Calculator before sending keystrokes

### Changed
- `start_messagebus.py` - Now integrates context tracking, LLM parsing, and action execution
- `requirements.txt` - Added PyObjC and google-generativeai dependencies
- `action_executor.py` - Now supports `target_app` parameter to focus app before keystrokes

### Technical Details
- New message types: `context:update`, `action:executed`, `action:execute`
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

[Unreleased]: https://github.com/merihilgor/voiceos/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/merihilgor/voiceos/releases/tag/v0.1.0
