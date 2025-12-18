<div align="center">
<img width="600" alt="Juvenile Banner" src="./istockphoto-538980297-1024x1024.jpg" />
</div>

# Juvenile (Voice AI OS Interface)

**Juvenile** is a next-generation multimodal AI interface that transforms how you interact with your computing devices. Instead of navigating menus and clicking buttons, you simply talk to your OS. It uses Google's Gemini models to understand your intent and native accessibility APIs to execute actions on your behalf.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Concept
Juvenile is an **AI Agent** acting as a **middleman between user voice and OS functions**. Powered by Google's Gemini, it translates natural language commands into operating system actions—no clicks required.

### Core Principles
*   **Fully Hands-Free**: Voice interface activates automatically. No clicks—ever.
*   **AI Agent Architecture**: Gemini acts as the reasoning layer, interpreting intent and orchestrating multi-step OS actions.
*   **Accessibility-First**: Designed for users who cannot perform mouse clicks (motor impairments, RSI, etc.).

### How It Works
```
[User Voice] → [Gemini AI] → [OS Bridge] → [macOS Actions]
                   ↓
           Function Calls (openApp, setVolume, etc.)
```

## Architecture Considerations
| Approach | Status | Notes |
|----------|--------|-------|
| **Web (Current)** | MVP | Quick iteration, cross-platform web code |
| **Tauri** | Recommended for Production | Rust backend, 10MB app, native performance |
| **Native Swift** | Future | Best macOS integration, lowest latency |

## Roadmap
**Phase 1: macOS MVP (Current)**
- Voice command capture
- Screen context understanding
- Basic OS control (App management, window control)

**Phase 2: Reliability & Feedback**
- Multi-step reasoning
- Lower latency
- Tauri migration

**Phase 3: Open Source & Cross-Platform**
- Abstracting OS interfaces
- Windows/Linux support
- Mobile Support (iOS/Android)
- Community contributions
- **Privacy & Compliance**: Data/image masking for PII protection
- **Security Audit**: Integration with Jarwis AI (OWASP/SANS coverage)

## Contributing
We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) to get started.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
