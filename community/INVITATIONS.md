# Community Invitation Drafts

Here are three drafted invitations tailored for different platforms to help you find contributors.

## 1. The "Community Launch" Post (Best for Reddit, Dev.to, Hacker News)

**Subject:** [Show HN] VoiceOS: An Open Source, Hands-Free AI OS Interface (Release: Juvenile)

**Body:**
Hello everyone! 👋

I’m excited to share **VoiceOS**, an open-source project I’ve been working on that reimagines how we interact with our computers. The current release, codenamed **Juvenile**, focuses on macOS control.

🔗 Repo: https://github.com/merihilgor/voiceos

🎙️ **What is VoiceOS?**
VoiceOS is a platform for multimodal AI agents that act as a middleman between your voice and your OS.
**Juvenile** (our macOS MVP) uses Google Gemini to understand your intent and the macOS Accessibility API to execute actions (like opening apps, managing windows, or controlling volume) completely hands-free.

🛠️ **Tech Stack**
*   **Frontend**: React + Vite
*   **AI Engine**: Google Gemini (Multimodal)
*   **Backend/Logic**: Node.js
*   **OS Integration**: macOS Accessibility API (AX)

🚀 **Roadmap & Help Needed**
We are currently in Phase 1 (macOS MVP) and looking for contributors to help us reach the next level. We specifically need help with:
*   **Tauri Migration**: We plan to move from a web-based interface to Tauri for better native performance and smaller binary sizes.
*   **Accessibility Logic**: Improving how we hook into macOS AXAPI to make the control loop smoother.
*   **Security**: We are integrating with Jarwis AI for security audits, but we need more eyes on data masking and privacy (PII protection).
*   **Windows/Linux Support**: Future-proofing the architecture for cross-platform support.

🌟 **Why Contribute?**
This is a chance to build a true "Voice OS" that helps people with motor impairments or RSI use computers more effectively. Plus, you get to play with the latest Multimodal AI agents!

Check out the code, star the repo, or grab a good first issue. Let's build the future of voice interfaces together!

## 2. The "Quick Pitch" (Best for Discord, Slack, Twitter/X)

**Text:**
🚀 Just launched **VoiceOS**! It's an open-source AI platform for hands-free computing. Our first release, **Juvenile**, lets you control macOS entirely with your voice using Google Gemini.

We are looking for contributors to help with:
🔹 React/Vite Frontend
🔹 Moving to Tauri (Rust/JS)
🔹 macOS Accessibility APIs
🔹 Privacy & Data Masking

If you want to build the future of hands-free computing, check us out!
🔗 https://github.com/merihilgor/voiceos

#OpenSource #AI #Gemini #Accessibility #MacOS #Tauri

## 3. The "Accessibility Focus" (Best for A11y Communities)

**Subject:** Building an Open Source, Hands-Free OS Interface (VoiceOS)

**Body:**
Hi all, I am building an open-source tool called **VoiceOS**. Our current release, **Juvenile**, is designed to make macOS fully accessible for users who cannot use a mouse or keyboard (e.g., due to RSI or motor impairments).

It uses Google Gemini to translate natural voice commands into actual OS actions via accessibility APIs. We are currently looking for developers interested in Assistive Tech to help improve the reliability of our voice-to-action loop on macOS.

If you have experience with macOS Accessibility APIs or Voice UI design, we would love your help.
Repo: https://github.com/merihilgor/voiceos

## 💡 Recommended Next Steps

Based on the project goals, here is where you should post these invites:

*   **r/Accessibility & r/Disability**: Your "Accessibility-First" principle makes this a perfect fit.
*   **r/Rust & r/Tauri**: Since your roadmap explicitly mentions a "Tauri Migration," you will find very eager contributors there who love rewriting web apps in Tauri.
*   **r/MacApps**: Great for finding users to test the MVP.
*   **Discord**: Join the "Learn AI Together" or "OpenAI/Gemini" developer Discords. Your use of Gemini for OS control is a hot topic.

> **Tip**: **VoiceOS** is the project name. **Juvenile** is the current release codename (like macOS Sierra). Use this distinction to clarify the project's scope vs. current status.
