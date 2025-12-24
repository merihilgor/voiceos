/**
 * ⚠️ DRAFT / INCOMPLETE - DO NOT RELY ON THIS DATA
 * 
 * Known Issues:
 * - Voice capture may record unintended audio/mistaken utterances
 * - Action success/failure status may not reflect actual outcomes
 * - Some failed actions may be logged as successful
 * - Data does not accurately represent real user experience
 * 
 * TODO: Fix before using for any analysis or self-improvement
 * 
 * ---
 * Analytics Service - Track usage for self-improvement
 * 
 * Collects: utterance → parsed intent → action → outcome
 * Storage: /api/analytics → logs/analytics.jsonl
 */

export interface UsageEvent {
    id: string;
    timestamp: string;
    sessionId: string;
    // Input
    utterance: string;
    speechLang: string;
    wakeWord: string;
    // Processing
    parsedIntent: string;
    parsedAction: string;
    toolCall: Record<string, any> | null;
    // Outcome
    success: boolean;
    error?: string;
    executionTimeMs: number;
}

interface PartialEvent {
    startTime: number;
    utterance: string;
    speechLang?: string;
    wakeWord?: string;
}

class AnalyticsService {
    private sessionId: string;
    private pendingEvents: Map<string, PartialEvent> = new Map();
    private enabled: boolean;

    constructor() {
        this.sessionId = this.generateId();
        // Enable via VITE_ANALYTICS_ENABLED=true (default: false)
        this.enabled = import.meta.env.VITE_ANALYTICS_ENABLED === 'true';
        if (this.enabled) {
            console.log(`[Analytics] Session: ${this.sessionId}, Enabled: true`);
        }
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Start tracking a command
     */
    startCommand(utterance: string, speechLang?: string, wakeWord?: string): string {
        if (!this.enabled) return '';

        const eventId = this.generateId();
        this.pendingEvents.set(eventId, {
            startTime: Date.now(),
            utterance,
            speechLang,
            wakeWord,
        });
        return eventId;
    }

    /**
     * Complete tracking with outcome
     */
    async endCommand(
        eventId: string,
        parsedIntent: string,
        parsedAction: string,
        toolCall: Record<string, any> | null,
        success: boolean,
        error?: string
    ): Promise<void> {
        if (!this.enabled || !eventId) return;

        const pending = this.pendingEvents.get(eventId);
        if (!pending) return;

        this.pendingEvents.delete(eventId);

        const event: UsageEvent = {
            id: eventId,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            utterance: pending.utterance,
            speechLang: pending.speechLang || 'en-US',
            wakeWord: pending.wakeWord || 'ayo',
            parsedIntent,
            parsedAction,
            toolCall,
            success,
            error,
            executionTimeMs: Date.now() - pending.startTime,
        };

        // Send to backend
        try {
            await fetch('/api/analytics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event),
            });
        } catch (e) {
            console.warn('[Analytics] Failed to send event:', e);
        }
    }

    /**
     * Track a complete command in one call
     */
    async trackCommand(
        utterance: string,
        parsedAction: string,
        success: boolean,
        options: {
            speechLang?: string;
            wakeWord?: string;
            parsedIntent?: string;
            toolCall?: Record<string, any>;
            error?: string;
            executionTimeMs?: number;
        } = {}
    ): Promise<void> {
        if (!this.enabled) return;

        const event: UsageEvent = {
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            utterance,
            speechLang: options.speechLang || 'en-US',
            wakeWord: options.wakeWord || 'ayo',
            parsedIntent: options.parsedIntent || '',
            parsedAction,
            toolCall: options.toolCall || null,
            success,
            error: options.error,
            executionTimeMs: options.executionTimeMs || 0,
        };

        try {
            await fetch('/api/analytics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event),
            });
        } catch (e) {
            console.warn('[Analytics] Failed to send event:', e);
        }
    }

    /**
     * Get analytics summary
     */
    async getSummary(): Promise<any> {
        try {
            const res = await fetch('/api/analytics/summary');
            return await res.json();
        } catch (e) {
            return { error: 'Failed to fetch summary' };
        }
    }

    /**
     * Get improvement suggestions
     */
    async getImprovements(): Promise<any> {
        try {
            const res = await fetch('/api/analytics/improvements');
            return await res.json();
        } catch (e) {
            return { error: 'Failed to fetch improvements' };
        }
    }
}

export const analytics = new AnalyticsService();
export default analytics;
