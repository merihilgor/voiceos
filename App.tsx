import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FunctionDeclaration, Type, GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { WindowFrame } from './components/os/WindowFrame';
import { Dock } from './components/os/Dock';
import { VoiceOrb } from './components/ui/VoiceOrb';
import { NoteApp } from './components/apps/NoteApp';
import { TerminalApp } from './components/apps/TerminalApp';
import { BrowserApp } from './components/apps/BrowserApp';
import { GalleryApp } from './components/apps/GalleryApp';
import { MediaApp } from './components/apps/MediaApp';
import { SystemApp } from './components/apps/SystemApp';
import { APP_ICONS, WALLPAPER_URL } from './constants';
import { WindowState, ThemeMode, AppDefinition } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';
import { Battery, Wifi, Search, Command } from 'lucide-react';

const apps: AppDefinition[] = [
  { id: 'notes', name: 'Notes', icon: APP_ICONS.notes, component: <NoteApp /> },
  { id: 'terminal', name: 'Terminal', icon: APP_ICONS.terminal, component: <TerminalApp /> },
  { id: 'browser', name: 'Browser', icon: APP_ICONS.browser, component: <BrowserApp /> },
  { id: 'gallery', name: 'Gallery', icon: APP_ICONS.gallery, component: <GalleryApp /> },
  { id: 'media', name: 'Music', icon: APP_ICONS.media, component: <MediaApp /> },
  { id: 'settings', name: 'System', icon: APP_ICONS.system, component: <SystemApp /> },
];

export default function App() {
  // OS State
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [volume, setVolume] = useState(50);
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);

  // Voice AI State
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 0-1 for visualizer
  const [session, setSession] = useState<any>(null); // Keep session ref
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for Audio Contexts to avoid recreation
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // --- OS Actions ---
  const openApp = useCallback((appId: string) => {
    const app = apps.find(a => a.id === appId);
    if (!app) return;

    setWindows(prev => {
      const existing = prev.find(w => w.id === appId);
      if (existing) {
        // Bring to front if already open
        return prev.map(w => w.id === appId ? { ...w, isOpen: true, isMinimized: false, zIndex: Date.now() } : w);
      }
      return [...prev, {
        id: appId,
        title: app.name,
        isOpen: true,
        isMinimized: false,
        isMaximized: false,
        zIndex: Date.now(),
        content: app.component,
        icon: app.icon
      }];
    });
    setActiveWindowId(appId);
  }, []);

  const closeApp = useCallback((appId: string) => {
    setWindows(prev => prev.filter(w => w.id !== appId));
  }, []);

  const toggleTheme = useCallback((mode?: ThemeMode) => {
    setTheme(prev => mode || (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const updateVolume = useCallback((vol: number) => {
    setVolume(Math.max(0, Math.min(100, vol)));
  }, []);

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
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      console.log("API Key present:", !!apiKey);
      if (!apiKey) {
        console.error("ERROR: No API key found. Set GEMINI_API_KEY in .env.local");
        setIsVoiceActive(false);
        return;
      }

      // Audio Setup
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // Input Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      console.log("Microphone access granted");

      const ai = new GoogleGenAI({ apiKey });

      console.log("Connecting to Gemini Live...");
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
            // Start processing input audio
            if (!inputAudioContextRef.current) return;

            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
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

                // Execute Action
                if (fc.name === 'openApp' || fc.name === 'closeApp' || fc.name === 'setVolume') {
                  try {
                    const response = await fetch('/api/execute', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(fc.args)
                    });
                    const data = await response.json();
                    result = { result: data.result || 'executed' };
                  } catch (err) {
                    console.error('Backend Error:', err);
                    result = { error: 'Failed to execute OS command' };
                  }
                } else if (fc.name === 'setTheme') {
                  toggleTheme((fc.args as any).mode);
                } else if (fc.name === 'controlMedia') {
                  window.dispatchEvent(new CustomEvent('voice-os-media-control', {
                    detail: { action: (fc.args as any).action }
                  }));
                  openApp('media');
                } else if (fc.name === 'playwright_control') {
                  // Dispatch Playwright command to BrowserApp
                  window.dispatchEvent(new CustomEvent('voice-os-playwright-cmd', {
                    detail: fc.args
                  }));
                  openApp('browser');
                } else if (fc.name === 'controlRealOS') {
                  // Call Backend API
                  const args = fc.args as any;
                  console.log('Executing Real OS Action:', args);
                  try {
                    const response = await fetch('/api/execute', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(args)
                    });
                    const data = await response.json();
                    result = { result: data.result || 'executed' };
                  } catch (err) {
                    console.error('Backend Error:', err);
                    result = { error: 'Failed to execute OS command' };
                  }
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

  // --- Rendering ---
  return (
    <div className={`h-screen w-screen overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'dark bg-black text-white' : 'bg-gray-100 text-black'}`}>

      {/* Background/Wallpaper */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-1000"
        style={{ backgroundImage: `url(${WALLPAPER_URL})`, opacity: theme === 'dark' ? 0.6 : 0.9 }}
      />

      {/* Minimal Voice-Only UI */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center">

        {/* Voice Orb - Always Centered */}
        <VoiceOrb
          isActive={isVoiceActive}
          isThinking={isThinking}
          volumeLevel={audioLevel}
          onClick={() => { }} // No-op: auto-started, no click needed
        />

        {/* Status Text */}
        <div className="mt-6 text-center text-sm font-light">
          {errorMessage ? (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-6 py-3 max-w-md">
              <p className="text-red-200 font-medium">⚠️ {errorMessage}</p>
            </div>
          ) : isVoiceActive ? (
            <p className="opacity-70">Listening... Say a command like "Open Calculator"</p>
          ) : (
            <p className="opacity-70">Initializing voice interface...</p>
          )}
        </div>

        {/* Branding */}
        <div className="absolute bottom-8 text-center opacity-40 text-xs">
          <p>Juvenile (Voice AI OS)</p>
          <p>Hands-Free macOS Control</p>
        </div>
      </div>
    </div>
  );
}
