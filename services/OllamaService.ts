/**
 * OllamaService - Connects to Ollama Cloud API for voice command processing.
 * Uses browser SpeechRecognition for input and Ollama for intelligent responses.
 * Supports vision mode for context-aware commands (click on X, go to visible folder).
 */

import { VisionService } from './VisionService';
import { analytics } from './Analytics';
import { maskingService } from './MaskingService';

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

    // Analytics context - updated by App.tsx when values change
    private speechLang: string = 'en-US';
    private wakeWord: string = 'ayo';

    // Keywords that trigger vision mode (context-aware screen actions)
    // Supports English and Turkish
    private static VISION_KEYWORDS = [
        // English
        'click on', 'click the', 'click ', 'select the', 'select ',
        'go to ', 'open the ', 'navigate to', 'scroll',
        'double click', 'right click', 'find the', 'where is',
        'folder', 'file', 'button', 'icon', 'menu',
        // Turkish
        'tıkla', 'tikla', 'bas', 'seç', 'aç ',
        'git ', 'kaydır', 'kaydir', 'bul', 'nerede',
        'klasör', 'dosya', 'buton', 'düğme', 'simge', 'menü'
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
     * Update speech language for analytics context.
     */
    setSpeechLang(lang: string) {
        this.speechLang = lang;
        debugLog('OllamaService', `speechLang updated to: ${lang}`);
    }

    /**
     * Update wake word for analytics context.
     */
    setWakeWord(word: string) {
        this.wakeWord = word;
        debugLog('OllamaService', `wakeWord updated to: ${word}`);
    }

    /**
     * Get analytics options with current context.
     */
    private getAnalyticsOptions(extra: Record<string, any> = {}): Record<string, any> {
        return {
            speechLang: this.speechLang,
            wakeWord: this.wakeWord,
            ...extra
        };
    }

    /**
     * Check if command needs vision processing using LLM-based intent classification.
     * Supports any language - the LLM understands the semantic meaning.
     */
    private async classifyVisionIntent(command: string, traceId: string): Promise<boolean> {
        // Fast path: check for obvious English keywords first (optimization)
        const lowerCommand = command.toLowerCase();
        const quickMatch = ['click', 'scroll', 'button', 'icon', 'folder', 'menu'].some(kw => lowerCommand.includes(kw));

        if (quickMatch) {
            if (DEBUG) console.log(`[DEBUG:classifyVisionIntent] Quick match for vision intent [TraceID: ${traceId}]`);
            return true;
        }

        // Use LLM for semantic classification (works in any language)
        try {
            const response = await fetch('/api/ollama/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Trace-ID': traceId },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{
                        role: 'user',
                        content: `Classify this command. Does it require SEEING the screen to execute?

Commands needing vision: clicking on elements, finding buttons, scrolling to content, locating icons/folders
Commands NOT needing vision: open app, type text, keyboard shortcuts, set volume, change language

Command: "${command}"

Reply with ONLY one word: VISION or TEXT`
                    }],
                    temperature: 0,
                    max_tokens: 10
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const classification = data.choices?.[0]?.message?.content?.trim().toUpperCase();
                const isVision = classification === 'VISION';

                if (DEBUG) {
                    console.log(`[DEBUG:classifyVisionIntent] LLM classification: ${classification} → ${isVision ? 'VISION MODE' : 'TEXT MODE'} [TraceID: ${traceId}]`);
                }

                return isVision;
            }
        } catch (error) {
            if (DEBUG) console.log(`[DEBUG:classifyVisionIntent] Classification failed, defaulting to TEXT mode [TraceID: ${traceId}]`);
        }

        return false; // Default to text mode if classification fails
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

    async processTextCommand(text: string): Promise<void> {
        if (!this.isConnected || !this.onmessage || !text) return;

        // Generate Trace ID for this command execution
        const traceId = crypto.randomUUID().substring(0, 8); // Short ID for readability
        debugLog('processTextCommand', `Processing: "${text}" [TraceID: ${traceId}]`);

        // Mask PII before sending to remote LLM (always-on)
        const maskResult = maskingService.maskText(text);
        const maskedText = maskResult.masked;

        if (maskResult.hasPII) {
            debugLog('processTextCommand', `PII detected and masked: ${maskResult.detections.map(d => d.type).join(', ')} [TraceID: ${traceId}]`);
            console.log(`[MASK:${traceId}] Original: "${text}" → Masked: "${maskedText}"`);
        }

        // Check for vision keywords first (use original text for keyword matching)
        if (this.enableVision && await this.classifyVisionIntent(text, traceId)) {
            debugLog('processTextCommand', `Vision intent detected: "${text}" [TraceID: ${traceId}]`);

            // Initialize VisionService if needed
            if (!this.visionService) {
                this.visionService = new VisionService({
                    apiKey: this.apiKey, // Re-use same key or config
                    baseUrl: this.baseUrl,
                    model: this.model
                });
                debugLog('processTextCommand', `VisionService initialized lazily [TraceID: ${traceId}]`);
            }

            // Use masked text for vision LLM
            const action = await this.visionService.processWithVision(maskedText, traceId);
            if (action) {
                await this.visionService.executeAction(action, traceId);
                analytics.trackCommand(maskedText, action.action, true, this.getAnalyticsOptions({ toolCall: action, traceId }));
                return;
            }
            // Fallback to standard flow if vision fails or doesn't return an action
            debugLog('processTextCommand', `Vision processing did not return an action, falling back to LLM [TraceID: ${traceId}]`);
        }

        console.log(`OllamaService: Sending to Ollama [TraceID: ${traceId}]: "${maskedText}"`);

        try {
            // Use backend proxy to avoid CORS
            const response = await fetch('/api/ollama/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Trace-ID': traceId, // Pass traceId in header
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: `You are VoiceOS, a voice assistant for macOS. Parse voice commands in ANY language.

OUTPUT: Return ONLY a single JSON object. Pick the most appropriate action:

{"action": "open_app", "app": "FullAppName"}       - Open application (use full name)
{"action": "close_app", "app": "FullAppName"}      - Close application
{"action": "open_path", "path": "~/path"}          - Open folder/file path
{"action": "shortcut", "keys": "cmd+key"}          - Keyboard shortcut (cmd+n, tab, etc.)
{"action": "keystrokes", "keys": "text"}           - Type text into active field
{"action": "click", "x": 100, "y": 200}            - Click at screen coordinates
{"action": "scroll", "direction": "up|down"}       - Scroll page
{"action": "set_nickname", "name": "newname"}      - Set wake word/nickname
{"action": "switch_language", "lang": "tr-TR"}     - Switch speech language (tr-TR, en-US, de-DE, fr-FR, es-ES)
{"action": "speak", "text": "response"}            - Voice response (ONLY if truly ambiguous)

BEHAVIOR:
- Understand intent in any language, output JSON
- For "call me X" / "nickname X" / "takma adın X" → set_nickname
- For "switch to Turkish" / "Türkçe" / "speak English" → switch_language
- For "new message/window" → shortcut cmd+n
- For "type/write X" → keystrokes with X
- For "go to next field" → shortcut tab
- Use full app names (e.g., "Microsoft Outlook" not "Outlook")
- Numbers/equations (e.g., "3x3", "equals", "+", "-") → keystrokes (user is typing into active app)
- NEVER compute math - just type it as keystrokes
- NO explanations, ONLY JSON`
                        },
                        { role: 'user', content: maskedText }
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

                    const parsed = JSON.parse(jsonStr);
                    debugLog('processTextCommand', 'Successfully parsed JSON:', parsed);

                    // Add traceId to the parsed object for downstream use if needed, or pass separately
                    this.handleParsedResponse(parsed, maskedText, traceId);

                } catch (e: any) {
                    console.error('OllamaService: Failed to parse JSON response', e);
                    debugLog('processTextCommand', 'JSON parse error. Raw content:', content);
                    this.simulateResponse("I'm having trouble understanding the response format.");
                    analytics.trackCommand(maskedText, 'error_json_parse', false, this.getAnalyticsOptions({ error: e.message, rawContent: content, traceId }));
                }
            } else {
                debugLog('processTextCommand', 'No content returned from LLM');
                analytics.trackCommand(maskedText, 'error_empty_response', false, this.getAnalyticsOptions({ traceId }));
            }

        } catch (error: any) {
            console.error('OllamaService Error:', error);
            debugLog('processTextCommand', 'API Request failed:', error);
            // Fallback - maybe simple keyword matching?
            analytics.trackCommand(maskedText, 'error_api', false, this.getAnalyticsOptions({ error: error.message, traceId }));
        }
    }

    private handleParsedResponse(parsed: any, originalText: string, traceId?: string) {
        if (!parsed || !parsed.action) {
            console.warn('OllamaService: Invalid parsed response', parsed);
            return;
        }

        if (DEBUG) {
            console.log('[DEBUG:handleParsedResponse] ----------------------------------------');
            console.log('[DEBUG:handleParsedResponse] Original text:', originalText);
            console.log('[DEBUG:handleParsedResponse] Parsed action:', parsed.action);
            console.log('[DEBUG:handleParsedResponse] Parsed data:', parsed);
            console.log('[DEBUG:handleParsedResponse] TraceID:', traceId);
        }

        // Track successful parsing (but execution tracking happens inside executeAction)

        // Execute the action
        if (parsed.action === 'open_app' && parsed.app) {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: openApp tool call');
            // Execute tool call via backend
            this.executeAction('openApp', { appId: parsed.app }, traceId);

        } else if (parsed.action === 'close_app' && parsed.app) {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: closeApp tool call');
            this.executeAction('closeApp', { appId: parsed.app }, traceId);

        } else if (parsed.action === 'shortcut' && parsed.keys) {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: shortcut execution');
            // Execute shortcut
            this.executeAction('shortcut', { keys: parsed.keys }, traceId);

        } else if (parsed.action === 'keystrokes' && parsed.keys) {
            // Type text
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: keystrokes execution');
            this.executeAction('keystrokes', { keys: parsed.keys }, traceId);

        } else if (parsed.action === 'open_path' && parsed.path) {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: open_path execution');
            // Open path
            this.executeAction('open_path', { path: parsed.path }, traceId);

        } else if (parsed.action === 'click') {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: click execution');
            // Click at coordinates or element
            this.executeAction('click', { x: parsed.x, y: parsed.y, button: parsed.button || 'left' }, traceId);
        } else if (parsed.action === 'scroll' && parsed.direction) {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: scroll execution');
            // Scroll in direction
            this.executeAction('scroll', { direction: parsed.direction, amount: parsed.amount || 3 }, traceId);
        } else if (parsed.action === 'speak' && parsed.text) {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: speak response');
            this.simulateResponse(parsed.text);
        } else if (parsed.action === 'set_nickname' && parsed.name) {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: set_nickname');
            // Dispatch event for App.tsx to handle
            window.dispatchEvent(new CustomEvent('voiceos:set_nickname', { detail: { name: parsed.name } }));
            this.simulateResponse(`Wake word changed to ${parsed.name}`);
            analytics.trackCommand(originalText, 'set_nickname', true, this.getAnalyticsOptions({ toolCall: { name: parsed.name }, traceId }));
        } else if (parsed.action === 'switch_language' && parsed.lang) {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → Routing to: switch_language');
            // Dispatch event for App.tsx to handle
            window.dispatchEvent(new CustomEvent('voiceos:switch_language', { detail: { lang: parsed.lang } }));
            this.simulateResponse(`Language switched to ${parsed.lang}`);
            analytics.trackCommand(originalText, 'switch_language', true, this.getAnalyticsOptions({ toolCall: { lang: parsed.lang }, traceId }));
        } else {
            if (DEBUG) console.log('[DEBUG:handleParsedResponse] → No matching action, using fallback');
            this.simulateResponse(`I heard "${originalText}" but I'm not sure how to handle it.`);
            // Track fallback as partial failure? Or just unknown action
            analytics.trackCommand(originalText, 'unknown_action', false, this.getAnalyticsOptions({ error: 'No matching action handler', traceId }));
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



    private async executeAction(action: string, data: any, traceId?: string) {
        try {
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(traceId ? { 'X-Trace-ID': traceId } : {})
                },
                body: JSON.stringify({ action, params: data })
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`OllamaService: ${action} executed`, result);
                // Track actual execution success
                analytics.trackCommand(`exec:${action}`, action, true, this.getAnalyticsOptions({ toolCall: result, traceId }));
            } else {
                console.error(`OllamaService: ${action} failed`, response.status);
                this.simulateResponse(`Failed to execute ${action}`);
                // Track execution failure
                analytics.trackCommand(`exec:${action}`, action, false, this.getAnalyticsOptions({ error: `HTTP ${response.status}`, traceId }));
            }
        } catch (error: any) {
            console.error(`OllamaService: ${action} error`, error);
            this.simulateResponse(`Error executing ${action}`);
            // Track execution error
            analytics.trackCommand(`exec:${action}`, action, false, this.getAnalyticsOptions({ error: error.message, traceId }));
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
