/**
 * VisionService - Handles vision-based desktop control.
 * Captures screenshots and uses vision LLM to identify UI elements.
 */

// Debug mode - set VITE_DEBUG=true in .env.local for enhanced logging
const DEBUG = import.meta.env.VITE_DEBUG === 'true';

interface VisionConfig {
    apiKey: string;
    baseUrl?: string;
    model?: string;
}

interface VisionAction {
    action: 'click' | 'double_click' | 'scroll' | 'type' | 'speak' | 'open_path';
    x?: number;
    y?: number;
    text?: string;
    path?: string;
    confidence?: number;
    element_description?: string;
}

export class VisionService {
    private apiKey: string;
    private baseUrl: string;
    private model: string;

    constructor(config: VisionConfig) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com';
        this.model = config.model || 'gemini-2.0-flash';

        if (DEBUG) {
            console.log('[DEBUG:VisionService] Initialized with:', {
                baseUrl: this.baseUrl,
                model: this.model
            });
        }
    }

    /**
     * Process a voice command with screen context.
     * Captures screenshot, sends to vision LLM, returns structured action.
     */
    async processWithVision(command: string): Promise<VisionAction | null> {
        if (DEBUG) {
            console.log('[DEBUG:VisionService] ========================================');
            console.log('[DEBUG:VisionService] PROCESSING COMMAND:', command);
            console.log('[DEBUG:VisionService] ========================================');
        }

        console.log(`VisionService: Processing "${command}" with vision...`);

        try {
            // 1. Capture screenshot
            if (DEBUG) console.log('[DEBUG:VisionService] Step 1: Capturing screenshot...');
            const screenshot = await this.captureScreen();
            if (!screenshot) {
                console.error('VisionService: Failed to capture screenshot');
                if (DEBUG) console.log('[DEBUG:VisionService] Screenshot capture FAILED');
                return null;
            }
            if (DEBUG) console.log('[DEBUG:VisionService] Screenshot captured, length:', screenshot.length);

            // 2. Send to vision LLM
            if (DEBUG) console.log('[DEBUG:VisionService] Step 2: Sending to vision LLM...');
            const action = await this.analyzeWithVisionLLM(screenshot, command);

            if (DEBUG) {
                console.log('[DEBUG:VisionService] Vision LLM returned action:', JSON.stringify(action, null, 2));
            }

            return action;

        } catch (error) {
            console.error('VisionService: Error', error);
            if (DEBUG) console.log('[DEBUG:VisionService] Error in processWithVision:', error);
            return null;
        }
    }

    /**
     * Capture the current screen.
     */
    private async captureScreen(): Promise<string | null> {
        try {
            const response = await fetch('/api/screenshot');
            if (!response.ok) {
                throw new Error(`Screenshot API error: ${response.status}`);
            }
            const data = await response.json();
            return data.image; // base64-encoded PNG
        } catch (error) {
            console.error('VisionService: Screenshot capture failed', error);
            return null;
        }
    }

    /**
     * Analyze screenshot with vision LLM.
     */
    private async analyzeWithVisionLLM(imageBase64: string, command: string): Promise<VisionAction | null> {
        const prompt = `You are a desktop automation assistant. Analyze the screenshot and the user's voice command to determine the appropriate action.

Given the screenshot and command, respond with a JSON object describing the action:

For clicking on a visible element:
{"action": "click", "x": 450, "y": 320, "element_description": "artifacts folder icon", "confidence": 0.9}

For double-clicking:
{"action": "double_click", "x": 450, "y": 320, "element_description": "file to open", "confidence": 0.9}

For scrolling:
{"action": "scroll", "x": 500, "y": 400, "direction": "down", "amount": 3}

For typing text:
{"action": "type", "text": "hello world"}

For speaking a response (when no visual action is needed):
{"action": "speak", "text": "I cannot find that element on screen"}

IMPORTANT:
- Provide exact pixel coordinates (x, y) based on the screenshot
- The screenshot dimensions are typically 1920x1080 or similar
- Look for folder icons, file names, buttons, menu items
- If the element is not visible, return a speak action explaining this

User command: "${command}"

Respond with ONLY valid JSON, no explanation.`;

        if (DEBUG) {
            console.log('[DEBUG:VisionLLM] ----------------------------------------');
            console.log('[DEBUG:VisionLLM] User command:', command);
            console.log('[DEBUG:VisionLLM] Prompt being sent to vision LLM:');
            console.log('[DEBUG:VisionLLM]', prompt);
            console.log('[DEBUG:VisionLLM] ----------------------------------------');
        }

        try {
            // Use dedicated Gemini Vision endpoint
            console.log('VisionService: Calling /api/vision...');
            const response = await fetch('/api/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64,
                    prompt,
                    model: this.model
                })
            });

            if (!response.ok) {
                const error = await response.json();
                if (DEBUG) console.log('[DEBUG:VisionLLM] API error response:', error);
                throw new Error(`Vision API error: ${error.error || response.status}`);
            }

            const data = await response.json();
            const content = data.text?.trim();

            if (DEBUG) {
                console.log('[DEBUG:VisionLLM] Raw API response:', JSON.stringify(data, null, 2));
                console.log('[DEBUG:VisionLLM] Extracted content:', content);
            }

            console.log('VisionService: Raw response:', content?.substring(0, 300));

            if (content) {
                // Parse JSON response
                let jsonStr = content;
                if (content.includes('```json')) {
                    jsonStr = content.split('```json')[1]?.split('```')[0]?.trim() || content;
                } else if (content.includes('```')) {
                    jsonStr = content.split('```')[1]?.split('```')[0]?.trim() || content;
                }

                // Try to extract JSON object if it's embedded in text
                const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    jsonStr = jsonMatch[0];
                }

                if (DEBUG) {
                    console.log('[DEBUG:VisionLLM] JSON string to parse:', jsonStr);
                }

                try {
                    const action = JSON.parse(jsonStr) as VisionAction;
                    if (DEBUG) {
                        console.log('[DEBUG:VisionLLM] Parsed action:', JSON.stringify(action, null, 2));
                    }
                    console.log('VisionService: Action detected', action);
                    return action;
                } catch (parseError) {
                    console.error('VisionService: JSON parse failed:', parseError, 'Content:', jsonStr);
                    if (DEBUG) {
                        console.log('[DEBUG:VisionLLM] JSON parse FAILED');
                        console.log('[DEBUG:VisionLLM] Parse error:', parseError);
                    }
                    return null;
                }
            }

            return null;

        } catch (error) {
            console.error('VisionService: Vision LLM error', error);
            return null;
        }
    }

    /**
     * Execute a vision action.
     */
    async executeAction(action: VisionAction): Promise<boolean> {
        console.log('VisionService: Executing', action);

        try {
            switch (action.action) {
                case 'click':
                case 'double_click':
                    if (action.x !== undefined && action.y !== undefined) {
                        const response = await fetch('/api/click', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                x: action.x,
                                y: action.y,
                                doubleClick: action.action === 'double_click'
                            })
                        });
                        return response.ok;
                    }
                    break;

                case 'type':
                    if (action.text) {
                        const response = await fetch('/api/execute', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'keystrokes', params: { keys: action.text } })
                        });
                        return response.ok;
                    }
                    break;

                case 'open_path':
                    if (action.path) {
                        const response = await fetch('/api/execute', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'open_path', params: { path: action.path } })
                        });
                        return response.ok;
                    }
                    break;

                case 'speak':
                    // Handle via TTS
                    if (action.text && 'speechSynthesis' in window) {
                        const utterance = new SpeechSynthesisUtterance(action.text);
                        speechSynthesis.speak(utterance);
                    }
                    return true;
            }

            return false;

        } catch (error) {
            console.error('VisionService: Execute error', error);
            return false;
        }
    }
}

// Singleton instance
let _visionService: VisionService | null = null;

export function getVisionService(config?: VisionConfig): VisionService {
    if (!_visionService && config) {
        _visionService = new VisionService(config);
    }
    return _visionService!;
}
