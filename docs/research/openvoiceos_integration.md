# Research Report: OpenVoiceOS Integration

This report analyzes the OpenVoiceOS (OVOS) repositories for potential reuse in the VoiceOS project.

## Ecosystem Overview
OpenVoiceOS is a mature, community-driven voice AI platform, primarily written in **Python**. It follows a modular architecture based on the Mycroft structure:
- **Core**: Message bus service.
- **Audio**: Text-to-Speech (TTS) and Audio playback.
- **Listener**: Wake word detection (STT).
- **Skills**: Modular capabilities (Weather, Timer, IoT).

## Compatibility Analysis
| Component | Tech Stack | VoiceOS Compatibility | Recommendation |
|-----------|------------|-----------------------|----------------|
| **ovos-core** | Python | Low (Direct) | Adopt Message Bus pattern (WebSockets) |
| **ovos-listener** | Python | Low (Direct) | Use VAD/Wake Word logic ideas |
| **ovos-gui** | Qt/QML | None | Stick to React/Electron |
| **Plugins** | Python | Low | Creating JS equivalents for key plugins |

## Reusability Opportunities

### 1. Architectural Patterns (High Value)
- **Message Bus**: OVOS uses a websocket-based message bus for inter-process communication. VoiceOS (Node.js) should adopt this to decouple the "Listener" from the "Executor". 
- **Skill Intent Structure**: The data model for intents (Padatious/Adapt) serves as a great reference for structuring Gemini's function calling schemas.

### 2. Specific Components
- **Wake Word Models**: We can leverage `.tflite` or `.onnx` models used by `ovos-listener` (e.g., for "Hey Mycroft" or custom words) and run them in Node.js using `onnxruntime-node`.
- **VAD (Voice Activity Detection)**: `ovos-vad-plugin-silero` is excellent. We can use the Silero VAD model in JS/WebAssembly implementation for the browser/electron client.

## Action Plan
1.  **Architecture**: Refactor VoiceOS to use a strictly defined event bus (e.g., `mitt` or internal `EventEmitter` over WebSockets) inspired by `ovos-bus-client`.
2.  **Wake Word**: Investigate porting `ovos-listener` logic to a Node.js service using `node-record-lpcm16` + `porcupine` or `onnxruntime`.
3.  **Cross-Compatibility**: Create a "Bridge" skill in OVOS that can send commands to VoiceOS, allowing a hybrid setup where OVOS handles the mic/wake word on a Raspberry Pi and VoiceOS executes the Mac actions.
