import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FunctionDeclaration, Type, GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { MockGeminiService } from './services/MockGeminiService';
import { OllamaService } from './services/OllamaService';
import { VoiceOrb } from './components/ui/VoiceOrb';
import { useMessageBus } from './src/hooks/useMessageBus';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';

// Command history type
interface CommandHistoryItem {
  id: number;
  text: string;
  result: string;
  timestamp: Date;
}

export default function App() {
  // AI State
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>([]);
  const [currentContext, setCurrentContext] = useState<string>('VoiceOS');

  // Voice AI State
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 0-1 for visualizer
  const [session, setSession] = useState<any>(null); // Keep session ref
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>(''); // Live speech transcript
  const [speechLang, setSpeechLang] = useState<string>('en-US'); // Speech recognition language

  // Refs for Audio Contexts to avoid recreation
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // --- OVOS MessageBus Integration ---
  const handleOvosIntent = useCallback((intent: string, data: Record<string, any>) => {
    console.log('OVOS Intent:', intent, data);

    // Add to command history
    const resultText = intent === 'open_app' ? `Opened ${data.app}`
      : intent === 'close_app' ? `Closed ${data.app}`
        : intent === 'switch_language' ? `Switched to ${data.language}`
          : `Executed ${intent}`;

    setCommandHistory(prev => [...prev, {
      id: Date.now(),
      text: intent,
      result: resultText,
      timestamp: new Date()
    }]);

    // Update context if app changed
    if (intent === 'open_app' && data.app) {
      setCurrentContext(data.app);
    }

    // Language switch
    if (intent === 'switch_language' && data.language) {
      setSpeechLang(data.language);
    }
  }, []);

  // Wake word handler - triggered when backend detects "Holo"
  const handleWakeWord = useCallback(() => {
    console.log('🎤 Holo detected! Activating voice...');
    // Visual feedback - could trigger speech recognition start
    // For now, the speech recognition is always on in mock mode
    // In the future, this could toggle a "listening" state
  }, []);

  const { isConnected: isOvosConnected, sendUtterance } = useMessageBus({
    autoConnect: true,
    onIntent: handleOvosIntent,
    onWakeWord: handleWakeWord
  });

  // Commands are now handled by the backend via MessageBus
  // No local app/window management needed

  // --- Gemini Live Integration ---

  // Define Tools
  const tools: FunctionDeclaration[] = [
    {
      name: 'openApp',
      description: 'Opens an application by its ID (notes, terminal, browser, gallery, media, settings).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          appId: { type: Type.STRING, description: 'The ID of the app to open. Options: notes, terminal, browser, gallery, media, settings' }
        },
        required: ['appId']
      }
    },
    {
      name: 'closeApp',
      description: 'Closes an application by its ID.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          appId: { type: Type.STRING, description: 'The ID of the app to close.' }
        },
        required: ['appId']
      }
    },
    {
      name: 'setTheme',
      description: 'Sets the system theme (light or dark).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          mode: { type: Type.STRING, description: 'light or dark' }
        },
        required: ['mode']
      }
    },
    {
      name: 'setVolume',
      description: 'Sets the system volume (0-100).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          level: { type: Type.NUMBER, description: 'Volume level from 0 to 100' }
        },
        required: ['level']
      }
    },
    {
      name: 'controlMedia',
      description: 'Controls the media player (play, pause, next track, previous track).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, description: 'The action to perform: play, pause, next, prev' }
        },
        required: ['action']
      }
    },
    {
      name: 'playwright_control',
      description: 'Executes browser automation commands using a Playwright-like interface. Use this to browse the web.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          command: { type: Type.STRING, description: 'The Playwright command: goto, click, fill, screenshot' },
          selector: { type: Type.STRING, description: 'CSS selector for the target element (for click/fill)' },
          value: { type: Type.STRING, description: 'Value to fill or URL to go to' }
        },
        required: ['command']
      }
    },
    {
      name: 'controlRealOS',
      description: 'Controls the actual macOS system. Use this to open apps, control volume, or execute system commands.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, description: 'The action to perform: openApp, closeApp, setVolume' },
          params: { type: Type.OBJECT, description: 'Parameters for the action (e.g. { appId: "Calculator" }, { level: 50 })' }
        },
        required: ['action', 'params']
      }
    }
  ];

  const connectToGemini = async () => {
    if (isVoiceActive) return; // Already connected

    try {
      setIsVoiceActive(true);
      setIsThinking(false);

      // Debug: Log API Key presence
      // Check for Mock Mode and LLM Provider
      const urlParams = new URLSearchParams(window.location.search);
      const geminiApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ollamaApiKey = process.env.OLLAMA_API_KEY;
      const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1';
      const llmModel = process.env.LLM_MODEL;
      const llmProvider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
      const envMock = import.meta.env.VITE_MOCK_MODE === 'true';
      const useMock = urlParams.get('mock') === 'true' || envMock;
      const useOllama = llmProvider === 'ollama' && ollamaApiKey;

      console.log("LLM Provider:", llmProvider);
      console.log("Gemini API Key present:", !!geminiApiKey);
      console.log("Ollama API Key present:", !!ollamaApiKey);
      console.log("Mock Mode:", useMock);
      console.log("Use Ollama:", useOllama);

      // Check for valid provider configuration
      if (!useMock && !useOllama && !geminiApiKey) {
        console.error("ERROR: No valid LLM provider configured. Set GEMINI_API_KEY or OLLAMA_API_KEY in .env.local");
        setErrorMessage("No LLM provider configured. Set GEMINI_API_KEY or OLLAMA_API_KEY in .env.local");
        setIsVoiceActive(false);
        return;
      }

      // Audio Setup - only needed for Gemini Live (real-time audio streaming)
      // Mock and Ollama modes use browser SpeechRecognition instead
      const needsAudioStream = !useMock && !useOllama;

      if (needsAudioStream) {
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        // Input Stream - only for Gemini Live
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        console.log("Microphone access granted for Gemini Live");
      } else {
        console.log("Skipping audio setup - using browser SpeechRecognition");
      }

      // Select AI service based on provider
      let ai: any;
      if (useMock) {
        ai = new MockGeminiService({ apiKey: "mock" });
        console.log("Using Mock Gemini Service");
      } else if (useOllama) {
        ai = new OllamaService({
          apiKey: ollamaApiKey!,
          baseUrl: ollamaBaseUrl,
          model: llmModel || 'gemma3:4b'
        });
        console.log("Using Ollama Service");
      } else {
        ai = new GoogleGenAI({ apiKey: geminiApiKey! });
        console.log("Using Google Gemini Live");
      }

      console.log("Connecting to AI service...");
      const sessionPromise = ai.live.connect({
        // Use gemini-1.5-flash for stable Live API support
        model: 'gemini-2.0-flash-exp',
        config: {
          responseModalities: [Modality.AUDIO],
          // Tools temporarily disabled for connection testing
          // tools: [{ functionDeclarations: tools }],
          systemInstruction: `You are VoiceOS, a hands-free voice assistant for controlling macOS.
                You respond only with voice. Keep responses short and conversational.
                When the user asks to open an app, just say "Opening [app name]" for now.`
        },
        callbacks: {
          onopen: () => {
            console.log("VoiceOS: Connected");
            // Start processing input audio - only for Gemini Live mode
            if (!inputAudioContextRef.current || !audioStreamRef.current) return;

            const source = inputAudioContextRef.current.createMediaStreamSource(audioStreamRef.current);
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

            // Throttle: Only process every Nth frame to reduce CPU load
            let frameCount = 0;
            const PROCESS_EVERY_N_FRAMES = 3; // Process 1 in 3 frames
            let isConnected = false; // Track connection state

            // Set connection state when opened
            sessionPromise.then(() => {
              isConnected = true;
              console.log("VoiceOS: Session ready, audio streaming enabled");
            }).catch((err) => {
              console.error("VoiceOS: Session failed to open", err);
              isConnected = false;
            });

            scriptProcessor.onaudioprocess = (e) => {
              frameCount++;

              // Skip frames to reduce CPU load
              if (frameCount % PROCESS_EVERY_N_FRAMES !== 0) return;

              // Don't send if not connected
              if (!isConnected) return;

              const inputData = e.inputBuffer.getChannelData(0);

              // Simplified visualization (sample fewer points)
              let sum = 0;
              const step = 16; // Sample every 16th point instead of all
              for (let i = 0; i < inputData.length; i += step) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / (inputData.length / step));
              setAudioLevel(rms * 3);

              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(sess => {
                try {
                  sess.sendRealtimeInput({ media: pcmBlob });
                } catch (err) {
                  console.warn("Audio send failed, connection may be closed");
                  isConnected = false;
                }
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Tool Calls
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                console.log("Tool Call:", fc.name, fc.args);
                let result: { result?: string; error?: string } = { result: 'ok' };

                // All actions are now handled by backend via OVOS MessageBus
                // Frontend just logs and updates command history
                const cmdText = `${fc.name}(${JSON.stringify(fc.args)})`;
                setCommandHistory(prev => [...prev, {
                  id: Date.now(),
                  text: fc.name,
                  result: `Executed: ${cmdText}`,
                  timestamp: new Date()
                }]);

                // Try backend for execution
                try {
                  await fetch('/api/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: fc.name, params: fc.args })
                  });
                  result = { result: 'executed' };
                } catch (e) {
                  console.warn("Backend unavailable", e);
                }

                sessionPromise.then(sess => sess.sendToolResponse({
                  functionResponses: [{
                    id: fc.id,
                    name: fc.name,
                    response: result
                  }]
                }));
              }
            }

            // Handle Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputAudioContextRef.current) {
              setIsThinking(false);
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

              const audioBuffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);

              source.onended = () => sourcesRef.current.delete(source);

              // Visualize Output (Simulated for now based on presence of data)
              setAudioLevel(0.5 + Math.random() * 0.5);
              setTimeout(() => setAudioLevel(0), audioBuffer.duration * 1000);
            }

            if (msg.serverContent?.turnComplete) {
              setIsThinking(false);
            }
          },
          onclose: (e: any) => {
            console.log("VoiceOS: Disconnected", e);
            if (e && e.reason) console.log("Close Reason:", e.reason);
            if (e && e.code) console.log("Close Code:", e.code);

            // Handle quota exceeded error
            if (e && e.code === 1011) {
              setErrorMessage("API Quota Exceeded. Check your Gemini API plan at aistudio.google.com");
            } else if (e && e.reason) {
              setErrorMessage(e.reason);
            }

            setIsVoiceActive(false);
          },
          onerror: (e: any) => {
            console.error("VoiceOS Error:", e);
            if (e && e.message) console.error("Error Message:", e.message);
            setIsVoiceActive(false);
          }
        }
      });

      setSession(sessionPromise);

    } catch (e) {
      console.error("Connection Failed", e);
      setIsVoiceActive(false);
    }
  };

  // Auto-start voice interface on mount (Hands-Free Accessibility)
  useEffect(() => {
    // Small delay to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      connectToGemini();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Speech Recognition - Always enabled for voice input
  // Works with all providers (Gemini, Ollama, Mock) as universal voice input
  useEffect(() => {
    console.log("Speech Recognition Effect - session:", !!session);

    if (!session) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = speechLang;
    console.log("Speech Recognition: Creating new instance with lang:", speechLang);

    recognition.onaudiostart = () => console.log("Speech: Audio capture started");
    recognition.onaudioend = () => console.log("Speech: Audio capture ended");
    recognition.onspeechstart = () => console.log("Speech: Speech detected!");
    recognition.onspeechend = () => console.log("Speech: Speech ended");
    recognition.onnomatch = () => console.log("Speech: No match found");
    recognition.onsoundstart = () => console.log("Speech: Sound started");
    recognition.onsoundend = () => console.log("Speech: Sound ended");

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript.trim();
      if (!text) return;
      const lower = text.toLowerCase();
      console.log("Voice Recognized:", text);

      // Update visible transcript - accumulate words, slide after 15
      setTranscript(prev => {
        const newWords = text.split(/\s+/);
        const prevWords = prev ? prev.split(/\s+/) : [];
        const allWords = [...prevWords, ...newWords];
        return allWords.slice(-15).join(' ');
      });

      // Voice command: Switch language
      // Turkish mode: "İngilizce", "English", "ingilizceye geç", "switch to English"
      // English mode: "Türkçe", "Turkish", "türkçeye geç", "switch to Turkish"
      const switchToEnglish = lower.includes('english') || lower.includes('ingilizce');
      const switchToTurkish = lower.includes('turkish') || lower.includes('türkçe');

      if (switchToTurkish && speechLang !== 'tr-TR') {
        setSpeechLang('tr-TR');
        setTranscript('');
        console.log("Switching to Turkish...");
        return;
      }
      if (switchToEnglish && speechLang !== 'en-US') {
        setSpeechLang('en-US');
        setTranscript('');
        console.log("Switching to English...");
        return;
      }

      if (text && session) {
        session.then((s: any) => {
          if (s.sendText) s.sendText(text);
        });
      }

      // Also send to OVOS MessageBus if connected
      if (text && isOvosConnected) {
        sendUtterance(text);
      }
    };

    let isActive = true; // Track if this effect instance is still active
    let isPausedForTTS = false; // Track if paused for TTS output

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      // Don't restart on aborted (happens during language switch) or no-speech
      if (event.error === 'aborted' || event.error === 'no-speech') {
        console.log("Speech: Will restart via onend handler");
        return;
      }
      // Only restart if this effect is still active and not paused for TTS
      if (isActive && !isPausedForTTS) {
        console.log("Speech: Restarting after error...");
        setTimeout(() => {
          try { recognition.start(); } catch (e) { /* ignore */ }
        }, 500);
      }
    };

    recognition.onend = () => {
      // Only restart if this effect instance is still active AND not paused for TTS
      // Add delay to prevent rapid restart loop
      if (isActive && !isPausedForTTS) {
        setTimeout(() => {
          if (isActive && !isPausedForTTS) {
            console.log("Speech: Recognition restarting...");
            try { recognition.start(); } catch (e) { /* ignore */ }
          }
        }, 1000);
      } else if (isPausedForTTS) {
        console.log("Speech: Not restarting - paused for TTS");
      }
    };

    // Listen for TTS events to pause/resume recognition (prevent feedback loop)
    const handleTTSStart = () => {
      console.log("Speech: Pausing for TTS output");
      isPausedForTTS = true;
      try { recognition.stop(); } catch (e) { /* ignore */ }
    };

    const handleTTSEnd = () => {
      console.log("Speech: Resuming after TTS output");
      isPausedForTTS = false;
      setTimeout(() => {
        if (isActive && !isPausedForTTS) {
          console.log("Speech: Starting recognition after TTS");
          try { recognition.start(); } catch (e) { /* ignore */ }
        }
      }, 500); // Small delay after TTS ends
    };

    window.addEventListener('voiceos:tts:start', handleTTSStart);
    window.addEventListener('voiceos:tts:end', handleTTSEnd);

    recognition.start();
    console.log(`Mock Mode: Speech Recognition started (${speechLang}).`);

    return () => {
      isActive = false; // Mark as inactive before stopping
      isPausedForTTS = false;
      recognition.stop();
      window.removeEventListener('voiceos:tts:start', handleTTSStart);
      window.removeEventListener('voiceos:tts:end', handleTTSEnd);
    };
  }, [session, speechLang]);

  // --- Rendering ---
  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">

      {/* Ambient background effects - Siri-inspired */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute rounded-full"
          style={{
            width: '500px',
            height: '500px',
            top: '15%',
            left: '20%',
            background: 'radial-gradient(circle, rgba(255,107,157,0.12), transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: '400px',
            height: '400px',
            bottom: '20%',
            right: '15%',
            background: 'radial-gradient(circle, rgba(192,132,252,0.1), transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: '350px',
            height: '350px',
            top: '50%',
            left: '60%',
            background: 'radial-gradient(circle, rgba(96,165,250,0.08), transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: 'linear-gradient(135deg, #ff6b9d, #c084fc, #60a5fa)' }}
          />
          <span className="text-lg font-semibold tracking-wide">VoiceOS</span>
          <span className="text-xs text-gray-500 ml-2">JUVENILE</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{
              background: isVoiceActive ? 'rgba(34,197,94,0.15)' : 'rgb(31,41,55)',
              color: isVoiceActive ? '#22c55e' : 'rgb(156,163,175)',
              border: isVoiceActive ? '1px solid rgba(34,197,94,0.3)' : 'none'
            }}
          >
            {isVoiceActive ? '● ACTIVE' : '○ STANDBY'}
          </span>
          <span className="text-gray-500">
            {speechLang === 'tr-TR' ? '🇹🇷' : '🇺🇸'}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex h-[calc(100vh-120px)]">

        {/* Center - Voice Orb */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <VoiceOrb
            isActive={isVoiceActive}
            isThinking={isThinking}
            volumeLevel={audioLevel}
            onClick={() => { }}
            context={currentContext}
          />

          {/* Transcript */}
          {transcript && (
            <div className="mt-8 max-w-lg px-6 py-3 rounded-xl bg-white/5 backdrop-blur border border-white/10">
              <p style={{ color: 'rgba(255,182,203,0.8)' }} className="italic text-center">
                "{transcript}"
              </p>
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div className="mt-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-red-300 text-sm">⚠️ {errorMessage}</p>
            </div>
          )}
        </div>

        {/* Right Panel - Command History */}
        <aside className="w-80 border-l border-white/5 p-6 overflow-y-auto">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Command History</h2>

          {commandHistory.length === 0 ? (
            <div className="text-gray-600 text-sm">
              <p>No commands yet.</p>
              <p className="mt-2 text-gray-500 text-xs">Try saying:</p>
              <ul className="mt-2 space-y-1 text-xs text-gray-500">
                <li>• "Open Calculator"</li>
                <li>• "3 by 3"</li>
                <li>• "Volume up"</li>
                <li>• "New tab"</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-3">
              {commandHistory.slice(-10).reverse().map(cmd => (
                <div key={cmd.id} className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-sm text-white/90">"{cmd.text}"</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,107,157,0.7)' }}>→ {cmd.result}</p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center py-3 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Context:</span>
          <span style={{ color: '#ff6b9d' }}>{currentContext}</span>
          <span className="mx-2">•</span>
          <span>Hands-Free macOS Control</span>
        </div>
      </footer>
    </div>
  );
}
