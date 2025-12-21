
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

                // Simulate network delay
                setTimeout(() => {
                    this.isConnected = true;
                    if (this.onopen) this.onopen();

                    // Start a loop to simulate occasional "thinking" and tool calls
                    this.startSimulationLoop();
                }, 800);

                return {
                    sendRealtimeInput: (input: { media: { payload: string; mimeType: string } }) => {
                        // In mock mode, we ignore audio input but log it
                        // console.log("MockGeminiService: Received audio input chunk");
                    },
                    sendToolResponse: (response: any) => {
                        console.log("MockGeminiService: Received tool response", response);
                        // After a tool response, maybe say something back
                        this.simulateResponse("Action executed successfully.");
                    },
                    disconnect: () => {
                        this.isConnected = false;
                        this.cleanup();
                        if (this.onclose) this.onclose({ code: 1000, reason: "Mock Disconnect" });
                    }
                };
            }
        };
    }

    private startSimulationLoop() {
        // 1. Simulate an initial greeting after 2 seconds
        this.timers.push(setTimeout(() => {
            this.simulateResponse("Hello! I am running in Mock Mode. I can't really hear you, but I can open apps.");
        }, 2000));

        // 2. Simulate opening an app after 8 seconds (demo)
        this.timers.push(setTimeout(() => {
            this.simulateToolCall("openApp", { appId: "notes" });
        }, 8000));
    }

    private simulateResponse(text: string) {
        if (!this.isConnected || !this.onmessage) return;

        // We can't easily simulate audio blobs without a real file, 
        // strictly speaking we should send a ModelTurn with audio data.
        // For now, we will just send a text part which might not be handled by the audio-only UI,
        // but the onmessage handler in App.tsx mainly looks for `serverContent?.modelTurn?.parts?.[0]?.inlineData?.data`
        // or `toolCall`.

        // Attempting to send a dummy message structure
        // Since App.tsx expects audio data for "speaking", we might just trigger the "Thinking" state toggle.

        const msg = {
            serverContent: {
                turnComplete: true,
                modelTurn: {
                    parts: []
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
