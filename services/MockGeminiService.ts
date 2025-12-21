
export class MockGeminiService {
    private onopen: (() => void) | null = null;
    private onmessage: ((msg: any) => void) | null = null;
    private onclose: ((e: any) => void) | null = null;
    private onerror: ((e: any) => void) | null = null;
    private isConnected = false;
    private timers: any[] = [];

    constructor(config: { apiKey: string }) {
        console.log("MockGeminiService initialized (Mock Mode)");
    }

    get live() {
        return {
            connect: async (options: { config: any, callbacks: any }) => {
                this.onopen = options.callbacks.onopen;
                this.onmessage = options.callbacks.onmessage;
                this.onclose = options.callbacks.onclose;
                this.onerror = options.callbacks.onerror;

                console.log("MockGeminiService: Connecting...");

                // Connect immediately to handle fast inputs
                this.isConnected = true;

                // Simulate brief network delay for lifecycle events
                setTimeout(() => {
                    if (this.onopen) this.onopen();
                    this.startSimulationLoop();
                }, 100);

                return {
                    sendRealtimeInput: (input: { media: { payload: string; mimeType: string } }) => {
                        // In mock mode, we ignore audio input
                    },
                    sendToolResponse: (response: any) => {
                        console.log("MockGeminiService: Received tool response", response);
                        this.simulateResponse("Action executed.");
                    },
                    disconnect: () => {
                        this.isConnected = false;
                        this.cleanup();
                        if (this.onclose) this.onclose({ code: 1000, reason: "Mock Disconnect" });
                    },
                    // Custom method for Mock Mode interaction
                    sendText: (text: string) => {
                        this.processTextCommand(text);
                    }
                };
            }
        };
    }

    private startSimulationLoop() {
        // 1. Simulate an initial greeting after 1.5 seconds
        this.timers.push(setTimeout(() => {
            this.simulateResponse("Mock Mode Online. Type a command to test.");
        }, 1500));
    }

    private processTextCommand(text: string) {
        console.log(`MockGeminiService: Processing command: "${text}"`);
        const lower = text.toLowerCase();

        if (lower.includes('open')) {
            const apps = ['notes', 'terminal', 'browser', 'gallery', 'media', 'system', 'calculator'];

            let appId = apps.find(a => lower.includes(a));
            if (appId === 'system') appId = 'settings';

            // "Real" Calculator Support
            // If user explicitly says "real" and "calculator", we send "Calculator" (Capitalized).
            // This tells App.tsx to still try opening the local 'calculator' app (Mock UI),
            // BUT the backend call inside App.tsx (which we enabled) will send { appId: "Calculator" }.
            // The backend's `openApp` uses `Application(appName).activate()`.
            // "Calculator" is the correct name for the macOS app.
            if (lower.includes('real') && appId === 'calculator') {
                this.simulateToolCall('openApp', { appId: 'Calculator' });
                return;
            }

            if (appId) {
                this.simulateToolCall('openApp', { appId });
                return;
            }
        }

        if (lower.includes('close')) {
            const apps = ['notes', 'terminal', 'browser', 'gallery', 'media', 'system', 'settings'];
            let appId = apps.find(a => lower.includes(a));
            if (appId === 'system') appId = 'settings';

            if (appId) {
                this.simulateToolCall('closeApp', { appId });
                return;
            }
        }

        this.simulateResponse(`I heard "${text}", but I don't have a mock action for that.`);
    }

    private simulateResponse(text: string) {
        if (!this.isConnected || !this.onmessage) return;

        // Send text response
        const msg = {
            serverContent: {
                turnComplete: true,
                modelTurn: {
                    parts: [{ text: text }]
                }
            }
        };
        this.onmessage(msg);
        console.log(`MockGeminiService: Simulated response: "${text}"`);
    }

    private simulateToolCall(name: string, args: any) {
        if (!this.isConnected || !this.onmessage) return;

        console.log(`MockGeminiService: Simulating tool call ${name}`);
        const msg = {
            toolCall: {
                functionCalls: [
                    {
                        id: `mock-call-${Date.now()}`,
                        name: name,
                        args: args
                    }
                ]
            }
        };
        this.onmessage(msg);
    }

    private cleanup() {
        this.timers.forEach(t => clearTimeout(t));
        this.timers = [];
    }
}
