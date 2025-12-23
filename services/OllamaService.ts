/**
 * OllamaService - Connects to Ollama Cloud API for voice command processing.
 * Uses browser SpeechRecognition for input and Ollama for intelligent responses.
 * Supports vision mode for context-aware commands (click on X, go to visible folder).
 */

import { VisionService } from './VisionService';

// Debug mode - set VITE_DEBUG=true in .env.local for enhanced logging
const DEBUG = import.meta.env.VITE_DEBUG === 'true';

function debugLog(category: string, ...args: any[]) {
    if (DEBUG) {
        console.log(`[DEBUG:${category}]`, ...args);
    }
}

interface OllamaConfig {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    enableVision?: boolean;
}

export class OllamaService {
    private onopen: (() => void) | null = null;
    private onmessage: ((msg: any) => void) | null = null;
    private onclose: ((e: any) => void) | null = null;
    private onerror: ((e: any) => void) | null = null;
    private isConnected = false;

    private apiKey: string;
    private baseUrl: string;
    private model: string;
    private visionService: VisionService | null = null;
    private enableVision: boolean;

    // Keywords that trigger vision mode (context-aware screen actions)
    private static VISION_KEYWORDS = [
        'click on', 'click the', 'click ', 'select the', 'select ',
        'go to ', 'open the ', 'navigate to', 'scroll',
        'double click', 'right click', 'find the', 'where is',
        'folder', 'file', 'button', 'icon', 'menu'
    ];

    constructor(config: OllamaConfig) {
        this.apiKey = config.apiKey || process.env.OLLAMA_API_KEY || 'ollama';
        this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1';
        this.model = config.model || process.env.LLM_MODEL || 'gemini-3-flash-preview';
        this.enableVision = config.enableVision !== false; // Default to true

        if (DEBUG) {
            console.log('[DEBUG:OllamaService] ========================================');
            console.log('[DEBUG:OllamaService] DEBUG MODE ENABLED');
            console.log('[DEBUG:OllamaService] ========================================');
            console.log('[DEBUG:OllamaService] Config:', {
                baseUrl: this.baseUrl,
                model: this.model,
                enableVision: this.enableVision
            });
            console.log('[DEBUG:OllamaService] Vision keywords:', OllamaService.VISION_KEYWORDS);
        }

        if (this.enableVision) {
            this.visionService = new VisionService({ apiKey: this.apiKey, model: this.model });
            console.log(`OllamaService initialized with VISION (${this.baseUrl}, model: ${this.model})`);
        } else {
            console.log(`OllamaService initialized (${this.baseUrl}, model: ${this.model})`);
        }
    }

    /**
     * Check if command needs vision processing.
     */
    private needsVision(command: string): boolean {
        const lowerCommand = command.toLowerCase();
        const matchedKeywords = OllamaService.VISION_KEYWORDS.filter(kw => lowerCommand.includes(kw));
        const needsVision = matchedKeywords.length > 0;

        if (DEBUG) {
            console.log('[DEBUG:needsVision] ----------------------------------------');
            console.log('[DEBUG:needsVision] Input command:', command);
            console.log('[DEBUG:needsVision] Lowercased:', lowerCommand);
            console.log('[DEBUG:needsVision] Checking against keywords:', OllamaService.VISION_KEYWORDS);
            console.log('[DEBUG:needsVision] Matched keywords:', matchedKeywords.length > 0 ? matchedKeywords : 'NONE');
            console.log('[DEBUG:needsVision] Result:', needsVision ? 'VISION MODE' : 'LLM MODE');
            console.log('[DEBUG:needsVision] ----------------------------------------');
        }

        return needsVision;
    }

    get live() {
        return {
            connect: async (options: { config: any; callbacks: any }) => {
                this.onopen = options.callbacks.onopen;
                this.onmessage = options.callbacks.onmessage;
                this.onclose = options.callbacks.onclose;
                this.onerror = options.callbacks.onerror;

                console.log("OllamaService: Connecting via proxy...");

                // Test connection via backend proxy (avoids CORS)
                try {
                    const response = await fetch('/api/ollama/models');

                    if (!response.ok) {
                        throw new Error(`Ollama API error: ${response.status}`);
                    }

                    this.isConnected = true;
                    if (this.onopen) this.onopen();
                    console.log("OllamaService: Connected successfully via proxy");

                } catch (error) {
                    console.error("OllamaService: Connection failed", error);
                    // Still connect but in degraded mode
                    this.isConnected = true;
                    if (this.onopen) this.onopen();
                }

                return {
                    sendRealtimeInput: (input: { media: { payload: string; mimeType: string } }) => {
                        // Audio input not supported - use browser SpeechRecognition
                    },
                    sendToolResponse: (response: any) => {
                        console.log("OllamaService: Received tool response", response);
                    },
                    disconnect: () => {
                        this.isConnected = false;
                        if (this.onclose) this.onclose({ code: 1000, reason: "Ollama Disconnect" });
                    },
                    // Process text commands via Ollama
                    sendText: async (text: string) => {
                        await this.processTextCommand(text);
                    }
                };
            }
        };
    }

    private async processTextCommand(text: string) {
        if (!this.isConnected || !this.onmessage) return;

        if (DEBUG) {
            console.log('[DEBUG:processTextCommand] ========================================');
            console.log('[DEBUG:processTextCommand] RECEIVED TEXT:', text);
            console.log('[DEBUG:processTextCommand] isConnected:', this.isConnected);
            console.log('[DEBUG:processTextCommand] enableVision:', this.enableVision);
            console.log('[DEBUG:processTextCommand] visionService:', !!this.visionService);
        }

        console.log(`OllamaService: Processing command: "${text}"`);

        // Check if this needs vision processing
        const needsVisionProcessing = this.enableVision && this.visionService && this.needsVision(text);

        if (DEBUG) {
            console.log('[DEBUG:processTextCommand] Routing decision:', needsVisionProcessing ? 'VISION' : 'LLM');
        }

        if (needsVisionProcessing) {
            console.log(`OllamaService: Using VISION mode for "${text}"`);
            await this.processWithVision(text);
            return;
        }


        try {
            // Use backend proxy to avoid CORS
            const response = await fetch('/api/ollama/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: `You are VoiceOS, a voice assistant for macOS. Parse the user's command and respond with a JSON object.

Available actions:

1. Open/close apps:
{"action": "open_app", "app": "AppName"}
{"action": "close_app", "app": "AppName"}

2. Navigate to folder (in Finder):
{"action": "open_path", "path": "~/Downloads"}
{"action": "open_path", "path": "~/Documents"}
{"action": "open_path", "path": "~/Desktop"}
{"action": "open_path", "path": "/Applications"}

3. Open file:
{"action": "open_path", "path": "~/Documents/file.pdf"}

4. Keyboard shortcut:
{"action": "shortcut", "keys": "cmd+z"}
{"action": "shortcut", "keys": "cmd+shift+n"}

5. Type text:
{"action": "keystrokes", "keys": "hello world"}

6. Speak a response:
{"action": "speak", "text": "Your response"}

EXAMPLES:
- "go to downloads" → {"action": "open_path", "path": "~/Downloads"}
- "open documents folder" → {"action": "open_path", "path": "~/Documents"}
- "open Calculator" → {"action": "open_app", "app": "Calculator"}
- "close Safari" → {"action": "close_app", "app": "Safari"}
- "undo" → {"action": "shortcut", "keys": "cmd+z"}

CRITICAL: Output ONLY valid JSON, no explanation. Keep response short.`
                        },
                        { role: 'user', content: text }
                    ],
                    temperature: 0.1,
                    max_tokens: 500  // Increased from 200 to prevent truncation
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content?.trim();

            if (DEBUG) {
                console.log('[DEBUG:LLM] ----------------------------------------');
                console.log('[DEBUG:LLM] Raw API response data:', JSON.stringify(data, null, 2));
                console.log('[DEBUG:LLM] Extracted content:', content);
            }

            if (content) {
                try {
                    // Try to parse as JSON directly
                    let jsonStr = content;
                    // If content contains markdown code block, extract it
                    if (content.includes('```json')) {
                        jsonStr = content.split('```json')[1].split('```')[0].trim();
                    } else if (content.includes('```')) {
                        jsonStr = content.split('```')[1].split('```')[0].trim();
                    }

                    if (DEBUG) {
                        console.log('[DEBUG:LLM] JSON string to parse:', jsonStr);
                    }

                    // Try to parse, with repair logic for truncated responses
                    let parsed;
                    try {
                        parsed = JSON.parse(jsonStr);
                    } catch (e) {
                        // Attempt to repair common truncation issues
                        if (DEBUG) console.log('[DEBUG:LLM] Initial parse failed, attempting repair...');

                        let repairedJson = jsonStr;

                        // Count braces
                        const openBraces = (repairedJson.match(/{/g) || []).length;
                        const closeBraces = (repairedJson.match(/}/g) || []).length;

                        // Try to close unclosed strings and add missing closing braces
                        if (openBraces > closeBraces) {
                            // Check if string is unclosed (odd number of quotes after last colon)
                            const lastColon = repairedJson.lastIndexOf(':');
                            if (lastColon > -1) {
                                const afterColon = repairedJson.substring(lastColon + 1);
                                const quoteCount = (afterColon.match(/"/g) || []).length;
                                if (quoteCount % 2 === 1) {
                                    repairedJson += '"';
                                    if (DEBUG) console.log('[DEBUG:LLM] Closed unclosed string');
                                }
                            }
                            // Add missing closing braces
                            for (let i = 0; i < openBraces - closeBraces; i++) {
                                repairedJson += '}';
                            }
                            if (DEBUG) console.log('[DEBUG:LLM] Repaired JSON:', repairedJson);
                        }

                        try {
                            parsed = JSON.parse(repairedJson);
                        } catch (e2) {
                            // Still failed - throw original error
                            throw e;
                        }
                    }

                    if (DEBUG) {
                        console.log('[DEBUG:LLM] Parsed JSON:', JSON.stringify(parsed, null, 2));
                    }

                    this.handleParsedResponse(parsed, text);
                } catch (parseError) {
                    if (DEBUG) {
                        console.log('[DEBUG:LLM] JSON parse failed:', parseError);
                        console.log('[DEBUG:LLM] Falling back to text response');
                    }
                    // If not valid JSON, treat as text response
                    this.simulateResponse(content);
                }
            }
        } catch (error) {
            console.error("OllamaService: API error", error);
            this.simulateResponse(`Sorry, I couldn't process "${text}". Please try again.`);
        }
    }

    private handleParsedResponse(parsed: any, originalText: string) {
        if (DEBUG) {
            console.log('[DEBUG:handleParsedResponse] ----------------------------------------');
            console.log('[DEBUG:handleParsedResponse] Original text:', originalText);
            console.log('[DEBUG:handleParsedResponse] Parsed action:', parsed.action);
            console.log('[DEBUG:handleParsedResponse] Parsed data:', parsed);
        }

        if (parsed.action === 'open_app' && parsed.app) {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: openApp tool call');
            this.simulateToolCall('openApp', { appId: parsed.app });
        } else if (parsed.action === 'close_app' && parsed.app) {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: closeApp tool call');
            this.simulateToolCall('closeApp', { appId: parsed.app });
        } else if (parsed.action === 'shortcut' && parsed.keys) {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: shortcut execution');
            // Execute shortcut via backend
            this.executeAction('shortcut', { keys: parsed.keys });
        } else if (parsed.action === 'keystrokes' && parsed.keys) {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: keystrokes execution');
            // Type keystrokes via backend
            this.executeAction('keystrokes', { keys: parsed.keys });
        } else if (parsed.action === 'open_path' && parsed.path) {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: open_path execution');
            // Open file or folder via backend
            this.executeAction('open_path', { path: parsed.path });
        } else if (parsed.action === 'speak' && parsed.text) {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: speak response');
            this.simulateResponse(parsed.text);
        } else {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → No matching action, using fallback');
            this.simulateResponse(`I heard "${originalText}" but I'm not sure how to handle it.`);
        }
    }

    /**
     * Process command using vision (screenshot analysis).
     */
    private async processWithVision(text: string) {
        if (!this.visionService) return;

        try {
            const action = await this.visionService.processWithVision(text);

            if (action) {
                // Execute the action
                const success = await this.visionService.executeAction(action);

                if (success && action.element_description) {
                    this.simulateResponse(`Done! Clicked on ${action.element_description}`);
                } else if (!success) {
                    this.simulateResponse(`I tried to ${action.action} but it didn't work.`);
                }
            } else {
                this.simulateResponse(`I couldn't identify what to click. Please be more specific.`);
            }
        } catch (error) {
            console.error('OllamaService: Vision processing error', error);
            this.simulateResponse(`Sorry, I had trouble seeing the screen. Please try again.`);
        }
    }

    private async executeAction(action: string, data: any) {
        try {
            console.log(`OllamaService: Executing ${action}`, data);
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, params: data })
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`OllamaService: ${action} executed`, result);
            } else {
                console.error(`OllamaService: ${action} failed`, response.status);
                this.simulateResponse(`Failed to execute ${action}`);
            }
        } catch (error) {
            console.error(`OllamaService: ${action} error`, error);
            this.simulateResponse(`Error executing ${action}`);
        }
    }

    private simulateResponse(text: string) {
        if (!this.isConnected || !this.onmessage) return;

        // Use browser speech synthesis for audio output
        // Dispatch events to pause/resume speech recognition
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;

            // Pause speech recognition while speaking to prevent feedback loop
            utterance.onstart = () => {
                console.log("OllamaService: TTS started, pausing recognition");
                window.dispatchEvent(new CustomEvent('voiceos:tts:start'));
            };
            utterance.onend = () => {
                console.log("OllamaService: TTS ended, resuming recognition");
                window.dispatchEvent(new CustomEvent('voiceos:tts:end'));
            };
            utterance.onerror = () => {
                window.dispatchEvent(new CustomEvent('voiceos:tts:end'));
            };

            speechSynthesis.speak(utterance);
        }

        const msg = {
            serverContent: {
                turnComplete: true,
                modelTurn: {
                    parts: [{ text: text }]
                }
            }
        };
        this.onmessage(msg);
        console.log(`OllamaService: Response: "${text}"`);
    }

    private simulateToolCall(name: string, args: any) {
        if (!this.isConnected || !this.onmessage) return;

        console.log(`OllamaService: Tool call ${name}`, args);
        const msg = {
            toolCall: {
                functionCalls: [
                    {
                        id: `ollama-call-${Date.now()}`,
                        name: name,
                        args: args
                    }
                ]
            }
        };
        this.onmessage(msg);
    }
}
