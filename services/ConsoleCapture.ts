/**
 * Console Logger - Captures browser console logs and forwards to backend.
 * Enables VLA Agent to receive real-time error feedback for self-correction.
 */

// Log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    data?: any;
    source: 'console' | 'fetch' | 'agent';
}

class ConsoleCapture {
    private buffer: LogEntry[] = [];
    private flushInterval: NodeJS.Timeout | null = null;
    private originalConsole: {
        log: typeof console.log;
        info: typeof console.info;
        warn: typeof console.warn;
        error: typeof console.error;
    };
    private enabled: boolean;
    private maxBufferSize = 100;

    constructor() {
        this.enabled = import.meta.env.VITE_LOG_CAPTURE !== 'false';

        // Store original console methods
        this.originalConsole = {
            log: console.log.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
        };

        if (this.enabled) {
            this.setup();
            // Log initialization (using original to avoid loop)
            this.originalConsole.log('[ConsoleCapture] ✅ Initialized - logs will be sent to backend');
        }
    }

    private setup() {
        // Override console methods to capture logs
        console.log = (...args) => {
            this.capture('info', args);
            this.originalConsole.log(...args);
        };

        console.info = (...args) => {
            this.capture('info', args);
            this.originalConsole.info(...args);
        };

        console.warn = (...args) => {
            this.capture('warn', args);
            this.originalConsole.warn(...args);
        };

        console.error = (...args) => {
            this.capture('error', args);
            this.originalConsole.error(...args);
        };

        // Capture unhandled errors
        window.addEventListener('error', (event) => {
            this.capture('error', [`Unhandled: ${event.message}`, {
                filename: event.filename,
                lineno: event.lineno
            }]);
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.capture('error', [`Unhandled Promise: ${event.reason}`]);
        });

        // Flush buffer periodically
        this.flushInterval = setInterval(() => this.flush(), 5000);

        // Initial flush to verify endpoint works
        setTimeout(() => {
            this.capture('info', ['[ConsoleCapture] Initial test log']);
            this.flush();
        }, 2000);
    }

    private capture(level: LogLevel, args: any[]) {
        // Format message
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message: message.slice(0, 1000), // Limit message length
            source: 'console',
        };

        this.buffer.push(entry);

        // Keep buffer size manageable
        if (this.buffer.length > this.maxBufferSize) {
            this.buffer.shift();
        }

        // Immediately flush errors
        if (level === 'error') {
            this.flush();
        }
    }

    /**
     * Log an agent-related event (for self-correction feedback)
     */
    logAgentEvent(level: LogLevel, message: string, data?: any) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            source: 'agent',
        };

        this.buffer.push(entry);

        // Agent errors are high priority
        if (level === 'error' || level === 'warn') {
            this.flush();
        }
    }

    /**
     * Get recent errors for agent feedback
     */
    getRecentErrors(count: number = 5): LogEntry[] {
        return this.buffer
            .filter(e => e.level === 'error' || e.level === 'warn')
            .slice(-count);
    }

    /**
     * Get all buffered logs
     */
    getBuffer(): LogEntry[] {
        return [...this.buffer];
    }

    /**
     * Flush buffer to backend
     */
    private async flush() {
        if (this.buffer.length === 0) return;

        const logs = [...this.buffer];
        this.buffer = [];

        try {
            await fetch('/api/logs/console', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logs }),
            });
        } catch (e) {
            // Don't log this error to avoid infinite loop
            this.originalConsole.warn('[ConsoleCapture] Failed to flush logs:', e);
        }
    }

    /**
     * Clean up
     */
    destroy() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }

        // Restore original console methods
        console.log = this.originalConsole.log;
        console.info = this.originalConsole.info;
        console.warn = this.originalConsole.warn;
        console.error = this.originalConsole.error;
    }
}

// Singleton instance
export const consoleCapture = new ConsoleCapture();
export default consoleCapture;
