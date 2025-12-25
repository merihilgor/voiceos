import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FunctionDeclaration, Type, GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { MockGeminiService } from './services/MockGeminiService';
import { OllamaService } from './services/OllamaService';
import { VoiceOrb } from './components/ui/VoiceOrb';
import { BandwidthMonitor } from './components/ui/BandwidthMonitor';
import { useMessageBus } from './src/hooks/useMessageBus';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';
import { consoleCapture } from './services/ConsoleCapture'; // VLA Agent error feedback

// Force consoleCapture to be included (prevents tree-shaking)
if (consoleCapture) {
  (window as any).__consoleCapture = consoleCapture;
}

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
  // Speech recognition language - switchable via voice command
  const [speechLang, setSpeechLang] = useState<string>(() => {
    return localStorage.getItem('voiceos_speechlang') || navigator.language || 'en-US';
  });
  const [isListening, setIsListening] = useState(false); // Wake word gating - only send to LLM when true
  const [wakeWord, setWakeWord] = useState<string>(() => {
    // Load custom wake word from localStorage, default to 'ayo'
    return localStorage.getItem('voiceos_wakeword') || 'ayo';
  });
  const [wakeWordVariants, setWakeWordVariants] = useState<string[]>(() => {
    // Load variants from localStorage
    const stored = localStorage.getItem('voiceos_wakeword_variants');
    return stored ? JSON.parse(stored) : ['ayo', 'hey yo', 'a yo', 'aio'];
  });

  // Refs for Audio Contexts to avoid recreation
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const listeningTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Wake word timeout
  const aiServiceRef = useRef<OllamaService | null>(null); // For analytics context updates

  // Debug mode
  const DEBUG = import.meta.env.VITE_DEBUG === 'true';

  // Sync speechLang changes to OllamaService for analytics
  useEffect(() => {
    if (aiServiceRef.current) {
      aiServiceRef.current.setSpeechLang(speechLang);
    }
  }, [speechLang]);

  // Sync wakeWord changes to OllamaService for analytics
  useEffect(() => {
    if (aiServiceRef.current) {
      aiServiceRef.current.setWakeWord(wakeWord);
    }
  }, [wakeWord]);

  // --- OVOS MessageBus Integration ---
  const handleOvosIntent = useCallback((intent: string, data: Record<string, any>) => {
    console.log('OVOS Intent:', intent, data);

    // Add to command history
    const resultText = intent === 'open_app' ? `Opened ${data.app}`
      : intent === 'close_app' ? `Closed ${data.app}`
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
  }, []);

  // Wake word handler - triggered when backend or user says the wake word
  const activateListening = useCallback(() => {
    if (DEBUG) console.log(`[DEBUG:WakeWord] ${wakeWord} detected, isListening = true`);
    console.log(`🎤 ${wakeWord.charAt(0).toUpperCase() + wakeWord.slice(1)} detected! Activating voice...`);
    setIsListening(true);

    // Clear any existing timeout
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
    }

    // Auto-reset after 10 seconds of no commands
    listeningTimeoutRef.current = setTimeout(() => {
      if (DEBUG) console.log('[DEBUG:WakeWord] Listening timeout - resetting to standby');
      console.log('💤 Listening timeout - returning to standby');
      setIsListening(false);
    }, 10000);
  }, [DEBUG, wakeWord]);

  // Generate wake word variants using LLM
  const generateVariants = useCallback(async (word: string): Promise<string[]> => {
    // Always include the base word
    const baseVariants = [word];

    try {
      if (DEBUG) console.log('[DEBUG:Variants] Calling LLM for variants of:', word);

      const response = await fetch('/api/ollama/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: import.meta.env.VITE_OLLAMA_MODEL || 'gemini-3-flash-preview',
          messages: [{
            role: 'user',
            content: `List 5 words that sound phonetically similar to "${word}" or that speech recognition might mishear as "${word}". Return ONLY a JSON array of lowercase strings. Example: ["macs", "max's", "marks"]`
          }],
          temperature: 0.3,
          max_tokens: 200  // Increased from 100 to prevent truncation
        })
      });

      if (!response.ok) {
        console.warn(`[Variants] API returned ${response.status}`);
        return baseVariants;
      }

      const data = await response.json();
      if (DEBUG) console.log('[DEBUG:Variants] Raw response:', data);

      const content = data.choices?.[0]?.message?.content || '';
      if (DEBUG) console.log('[DEBUG:Variants] Content:', content);

      // Extract JSON array from response - handle incomplete JSON
      const match = content.match(/\[[\s\S]*?\]/);
      if (match) {
        try {
          const variants = JSON.parse(match[0]) as string[];
          const allVariants = [word, ...variants.map((v: string) => v.toLowerCase().trim())];
          if (DEBUG) console.log('[DEBUG:Variants] Parsed variants:', allVariants);
          return allVariants;
        } catch (parseError) {
          console.warn('[Variants] Failed to parse JSON:', match[0], parseError);
        }
      } else {
        console.warn('[Variants] No JSON array found in response:', content);
      }
    } catch (e) {
      console.warn('Failed to generate variants:', e);
    }

    // Fallback: return just the word
    return baseVariants;
  }, [DEBUG]);

  // Set custom wake word (nickname)
  const setNickname = useCallback(async (newName: string): Promise<boolean> => {
    const normalized = newName.toLowerCase().trim();
    if (normalized.length >= 2 && normalized.length <= 15) {
      setWakeWord(normalized);
      localStorage.setItem('voiceos_wakeword', normalized);

      // Generate variants via LLM
      console.log(`⏳ Generating variants for "${normalized}"...`);
      const variants = await generateVariants(normalized);
      setWakeWordVariants(variants);
      localStorage.setItem('voiceos_wakeword_variants', JSON.stringify(variants));

      console.log(`✅ Wake word changed to: "${normalized}"`);
      console.log(`📝 Variants: ${variants.join(', ')}`);
      return true;
    }
    return false;
  }, [generateVariants]);

  const handleWakeWord = useCallback(() => {
    activateListening();
  }, [activateListening]);

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
        const ollamaService = new OllamaService({
          apiKey: ollamaApiKey!,
          baseUrl: ollamaBaseUrl,
          model: llmModel || 'gemma3:4b'
        });
        // Initialize analytics context with current values
        ollamaService.setSpeechLang(speechLang);
        ollamaService.setWakeWord(wakeWord);
        aiServiceRef.current = ollamaService;
        ai = ollamaService;
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

                // Try backend for execution with self-correction retry
                const MAX_RETRIES = 2;
                let currentAction = fc.name;
                let currentParams = fc.args;

                for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                  try {
                    const response = await fetch('/api/execute', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: currentAction, params: currentParams })
                    });

                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                      const errorMsg = errorData.error || `HTTP ${response.status}`;
                      console.error(`API Error (${response.status}):`, errorData);

                      // Self-correction: if openApp failed, ask LLM to correct the app name
                      if (currentAction === 'openApp' && attempt < MAX_RETRIES && errorMsg.includes('Unable to find')) {
                        console.log(`[Self-Correction] Asking LLM to fix app name (attempt ${attempt + 1})`);

                        // Ask LLM to correct the app name
                        const correctionPrompt = `The macOS app "${currentParams.appId}" was not found.

IMPORTANT: On macOS, apps often have full names like:
- "Outlook" should be "Microsoft Outlook"
- "Chrome" should be "Google Chrome"  
- "VSCode" should be "Visual Studio Code"

What is the correct full application name for "${currentParams.appId}"?

Reply with ONLY the JSON: {"app": "Full App Name"}`;

                        try {
                          const correctionResponse = await fetch('/api/ollama/chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              model: import.meta.env.VITE_OLLAMA_MODEL || 'gemini-3-flash-preview',
                              messages: [{ role: 'user', content: correctionPrompt }],
                              temperature: 0.1,
                              max_tokens: 150  // Increased from 50 to prevent truncation
                            })
                          });

                          if (correctionResponse.ok) {
                            const correctionData = await correctionResponse.json();
                            const content = correctionData.choices?.[0]?.message?.content || '';
                            console.log(`[Self-Correction] LLM raw response: ${content}`);

                            // Try multiple regex patterns
                            let correctedApp = null;
                            const patterns = [
                              /"app"\s*:\s*"([^"]+)"/,           // {"app": "Name"}
                              /Microsoft\s+\w+/i,                 // Microsoft Outlook
                              /Google\s+\w+/i,                    // Google Chrome
                              /Visual\s+Studio\s+\w+/i,           // Visual Studio Code
                            ];

                            for (const pattern of patterns) {
                              const match = content.match(pattern);
                              if (match) {
                                correctedApp = match[1] || match[0];
                                break;
                              }
                            }

                            if (correctedApp && correctedApp !== currentParams.appId) {
                              console.log(`[Self-Correction] ✅ LLM suggested: ${correctedApp}`);
                              currentParams = { ...currentParams, appId: correctedApp };
                              continue; // Retry with corrected name
                            } else {
                              console.log(`[Self-Correction] ❌ LLM didn't provide a new name`);
                            }
                          } else {
                            console.error(`[Self-Correction] LLM request failed: ${correctionResponse.status}`);
                          }
                        } catch (correctionError) {
                          console.error(`[Self-Correction] Error calling LLM:`, correctionError);
                        }
                      }

                      result = { error: errorMsg };
                      break;
                    } else {
                      const data = await response.json();
                      result = { result: data.result || 'executed' };
                      if (attempt > 0) {
                        console.log(`[Self-Correction] Success after ${attempt + 1} attempts!`);
                      }
                      break;
                    }
                  } catch (e) {
                    console.warn("Backend unavailable", e);
                    result = { error: 'Backend unavailable' };
                    break;
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

      // DESIGN PRINCIPLE: No hardcoded voice patterns!
      // ALL voice commands go to LLM for multi-language interpretation.
      // The LLM will return actions like set_nickname, switch_language, etc.

      // Use dynamically generated wake word variants from LLM (stored in state)
      // Escape special regex chars and build pattern
      const escapedVariants = wakeWordVariants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      // Match at word boundary OR at start of string
      const wakeWordPattern = new RegExp(`(?:^|\\b)(${escapedVariants.join('|')})(?:\\b|\\s|$)`, 'i');
      const wakeMatch = lower.match(wakeWordPattern);

      if (wakeMatch) {
        // Activate listening mode
        activateListening();

        // Extract command after wake word (if any)
        const matchIndex = lower.indexOf(wakeMatch[0]);
        const afterWake = text.substring(matchIndex + wakeMatch[0].length).trim();

        if (afterWake) {
          // Send the command part (without the wake word)
          if (DEBUG) console.log(`[DEBUG:WakeWord] Command after ${wakeWord}:`, afterWake);

          if (session) {
            session.then((s: any) => {
              if (s.sendText) s.sendText(afterWake);
            });
          }
          if (isOvosConnected) {
            sendUtterance(afterWake);
          }
        }
        return; // Don't process further - we handled it
      }

      // Only send to LLM if we're in listening mode (wake word was said recently)
      if (!isListening) {
        if (DEBUG) console.log('[DEBUG:WakeWord] Command gated - isListening is false, ignoring:', text);
        return;
      }

      // Reset the listening timeout on each command (extend the window)
      activateListening();

      // Send to LLM
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
  }, [session, speechLang, wakeWordVariants]); // Added wakeWordVariants to re-run on nickname change

  // LLM-dispatched commands listener (separate from recognition to avoid closure issues)
  useEffect(() => {
    const handleSetNickname = (e: Event) => {
      const detail = (e as CustomEvent<{ name: string }>).detail;
      console.log(`🏷️ LLM requested nickname change to: ${detail.name}`);
      setNickname(detail.name);
    };
    const handleSwitchLanguage = (e: Event) => {
      const detail = (e as CustomEvent<{ lang: string }>).detail;
      console.log(`🌍 LLM requested language switch to: ${detail.lang}`);
      setSpeechLang(detail.lang);
      localStorage.setItem('voiceos_speechlang', detail.lang);
    };

    window.addEventListener('voiceos:set_nickname', handleSetNickname);
    window.addEventListener('voiceos:switch_language', handleSwitchLanguage);

    return () => {
      window.removeEventListener('voiceos:set_nickname', handleSetNickname);
      window.removeEventListener('voiceos:switch_language', handleSwitchLanguage);
    };
  }, [setNickname]);

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
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex h-[calc(100vh-120px)]">

        {/* Center - Voice Orb */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <VoiceOrb
            isActive={isVoiceActive}
            isThinking={isThinking}
            isListening={isListening}
            wakeWord={wakeWord}
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

      {/* Debug: Bandwidth Monitor */}
      {DEBUG && <BandwidthMonitor visible={true} />}
    </div>
  );
}
