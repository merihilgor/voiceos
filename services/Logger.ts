/**
 * Logger Service - Unified logging with levels
 * 
 * Usage:
 *   import { logger } from './services/Logger';
 *   logger.debug('Detailed info');
 *   logger.info('Normal operation');
 *   logger.warn('Recoverable issue');
 *   logger.error('Failure', error);
 * 
 * Config: VITE_LOG_LEVEL=debug|info|warn|error (default: info)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    data?: any;
}

class Logger {
    private level: LogLevel;
    private buffer: LogEntry[] = [];
    private maxBufferSize = 100;

    constructor() {
        const envLevel = (import.meta.env.VITE_LOG_LEVEL || 'info').toLowerCase();
        this.level = LOG_LEVELS[envLevel as LogLevel] !== undefined ? envLevel as LogLevel : 'info';
        console.log(`[Logger] Initialized with level: ${this.level}`);
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
    }

    private formatTimestamp(): string {
        return new Date().toISOString();
    }

    private log(level: LogLevel, message: string, ...data: any[]): void {
        if (!this.shouldLog(level)) return;

        const entry: LogEntry = {
            timestamp: this.formatTimestamp(),
            level,
            message,
            data: data.length > 0 ? data : undefined,
        };

        // Store in buffer for potential export
        this.buffer.push(entry);
        if (this.buffer.length > this.maxBufferSize) {
            this.buffer.shift();
        }

        // Output to console with styling
        const styles: Record<LogLevel, string> = {
            debug: 'color: #6b7280',
            info: 'color: #3b82f6',
            warn: 'color: #f59e0b; font-weight: bold',
            error: 'color: #ef4444; font-weight: bold',
        };

        const prefix = `[${entry.timestamp.split('T')[1].split('.')[0]}] [${level.toUpperCase()}]`;

        if (data.length > 0) {
            console[level === 'debug' ? 'log' : level](`%c${prefix} ${message}`, styles[level], ...data);
        } else {
            console[level === 'debug' ? 'log' : level](`%c${prefix} ${message}`, styles[level]);
        }

        // Send errors to backend for persistence
        if (level === 'error') {
            this.persistError(entry);
        }
    }

    private async persistError(entry: LogEntry): Promise<void> {
        try {
            await fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry),
            });
        } catch (e) {
            // Silent fail - don't create infinite error loop
        }
    }

    debug(message: string, ...data: any[]): void {
        this.log('debug', message, ...data);
    }

    info(message: string, ...data: any[]): void {
        this.log('info', message, ...data);
    }

    warn(message: string, ...data: any[]): void {
        this.log('warn', message, ...data);
    }

    error(message: string, ...data: any[]): void {
        this.log('error', message, ...data);
    }

    // Get buffered logs for export/display
    getBuffer(): LogEntry[] {
        return [...this.buffer];
    }

    // Clear buffer
    clearBuffer(): void {
        this.buffer = [];
    }

    // Set level dynamically
    setLevel(level: LogLevel): void {
        this.level = level;
        this.info(`Log level changed to: ${level}`);
    }

    getLevel(): LogLevel {
        return this.level;
    }
}

// Singleton instance
export const logger = new Logger();
export default logger;
