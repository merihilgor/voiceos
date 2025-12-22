# Contributing to VoiceOS

First off, thanks for taking the time to contribute!

## Why Contribute?
By contributing to **VoiceOS** (specifically the **Juvenile** release), you are helping to build a true "Voice OS" that empowers people with motor impairments, RSI, or disabilities to use computers more effectively. This is not just an AI wrapper—it's an assistive technology tool that aims to restore digital independence.

Plus, you'll get to work with cutting-edge tech:
*   **Multimodal AI Agents** (Google Gemini)
*   **Native OS Automation** (Accessibility APIs)
*   **Cross-Platform Architecture** (Standardizing control loops)

## Core Design Principle: Accessibility-First
**VoiceOS (Juvenile)** is designed for users who **cannot perform mouse clicks**. All features must be operable via voice commands alone.

> **Any contribution that introduces a click-required interaction will be rejected.**

When implementing new features:
*   Voice must be the primary (and only required) input method.
*   Confirmations must be voice-based, not visual dialogs requiring clicks.
*   The app auto-activates voice recognition on launch—no activation button.

## Call for Contributions
We are currently focusing on:
*   **macOS MVP**: Enhancing the stability of the React front-end.
*   **Security**: Integrating compliance headers and security checks (Jarwis AI or similar roadmap).
*   **Cross-Platform**: Windows/Linux architectural proposals.

## How to Contribute

1.  **Fork the repository**.
2.  **Create a branch** for your feature or fix (`git checkout -b feature/amazing-feature`).
3.  **Commit your changes** (`git commit -m 'Add some amazing feature'`).
4.  **Push to the branch** (`git push origin feature/amazing-feature`).
5.  **Open a Pull Request**.

## Coding Standards
*   Use TypeScript for all new components.
*   Ensure E2E tests pass (`npm run test:e2e`) before submitting.
*   Follow the existing file structure in `components/` and `services/`.
