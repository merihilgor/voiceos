<div align="center">
<img width="600" alt="Juvenile Banner" src="./istockphoto-538980297-1024x1024.jpg" />
</div>

# VoiceOS: Juvenile Release

**VoiceOS** is a next-generation multimodal AI operating system interface.
**Juvenile** is the current release codename (macOS MVP).

The system transforms how you interact with your computing devices. Instead of navigating menus and clicking buttons, you simply talk to your OS. It uses Google's Gemini models to understand your intent and native accessibility APIs to execute actions on your behalf.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/Website-Live-blue)](https://merihilgor.github.io/voiceos/)

🌐 **[View Live Website](https://merihilgor.github.io/voiceos/)**

## Concept
**Juvenile** (the current VoiceOS release) is an **AI Agent acting as a middleman between user voice and OS functions**. The system translates natural voice commands into operating system actions through Google's Gemini models, enabling fully hands-free computer control.

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

## Architecture Overview

### Core Components
*   **Frontend Interface**: A React-based web interface (Vite) acting as the user's primary interaction point.
*   **AI Engine**: Powered by Google Gemini (Multimodal capabilities) for intent recognition and planning.
*   **OS Integration Layer**:
    *   **macOS (MVP)**: Utilizes the macOS Accessibility API (AX) to read screen state and execute controls programmatically.
    *   **Cross-Platform (Future)**: Specific adaptors for Windows/Linux.

### Local vs. Cloud Architecture
*   **Cloud Layer**: Handles complex reasoning, vision processing (screen analysis), and conversation management via the Gemini API.
*   **Local Layer**: A lightweight client responsible for capturing voice/audio, taking screenshots, and executing the low-level system commands dictated by the Cloud Layer.

## Roadmap

### Phase 1: macOS MVP (Current Focus)
*   **Objective**: Establish a stable control loop on macOS.
*   **Features**:
    *   Voice command capture.
    *   Basic screen context understanding.
    *   Execution of fundamental actions (app launching, window management).
    *   Integration with macOS Accessibility APIs.

### Phase 2: Enhanced Reliability & Features
*   **Objective**: Improve accuracy and add complex workflows.
*   **Features**:
    *   Multi-step reasoning loops.
    *   User feedback mechanisms.
    *   Latency optimization.
    *   **Eye Tracking**: Cursor control via eye movement (multimodal input).
    *   **Tauri Migration**: Transition to Tauri for native performance and small binary size.

### Phase 3: Future Ideas & Expansion
*   **Cross-Platform Clients**:
    *   Windows UI Automation support.
    *   Linux automation support.
    *   Mobile Support (iOS/Android).
*   **Security & Compliance**:
    *   **Security Audit**: Integration with **Jarwis AI** by BKD Labs Pvt Ltd for continuous assessment (OWASP Top 10, SANS 25).
    *   **Privacy & Data Protection**: Implementation of automatic data/image masking for PII, financial data, and sensitive UI elements.
    *   **Audit Logging**: Track data sent to external APIs for compliance.

## Technical Constraints & Logic
*   **Accessibility**: Heavily relies on platform-specific Accessibility APIs (e.g., Apple's AXAPI).
*   **Privacy**: Screen data handling must be secure and transparent.
*   **Latency**: Voice-to-Action latency is a critical metric for UX.

## Security & Privacy Details

### Jarwis AI Integration Goals
*   **Continuous Assessment**: Leverage Jarwis's autonomous engine to simulate ethical hacker curiosity and penetration testing rigor.
*   **Compliance**: Ensure coverage for **OWASP Top 10** and **SANS 25** vulnerabilities.
*   **Scope**: API Security, Cloud Posture, and Code-Level Remediation.

### Privacy & Data Protection
*   **Data/Image Masking**: Before sending screen captures to Gemini, implement automatic masking of PII, financial data, and sensitive UI elements.
*   **Local Processing**: Mask data client-side before transmission to cloud.
*   **User Consent**: Clear opt-in for screen analysis with privacy implications.

## Contributing
We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) to get started.

## Acknowledgements
**VoiceOS** is architecturally inspired by the **[OpenVoiceOS](https://openvoiceos.org)** ecosystem.
While our tech stack differs (Node.js/React vs. Python/Qt), we aim to adopt their modular event-bus architecture and contribute back to the open voice ecosystem where possible.

📄 **[Read the Full Research Report](docs/research/openvoiceos_integration.md)**

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
