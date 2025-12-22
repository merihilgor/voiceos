/**
 * useMessageBus - React hook for OVOS MessageBus WebSocket communication
 * 
 * Connects to the OVOS backend on ws://localhost:8181
 * Sends voice transcripts as recognizer_loop:utterance messages
 * Receives intent responses for execution by the frontend
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface MessageBusMessage {
    type: string;
    data?: Record<string, any>;
    context?: Record<string, any>;
}

export interface UseMessageBusOptions {
    autoConnect?: boolean;
    url?: string;
    onIntent?: (intent: string, data: Record<string, any>) => void;
}

export function useMessageBus(options: UseMessageBusOptions = {}) {
    const {
        autoConnect = true,
        url = 'ws://localhost:8181',
        onIntent
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<MessageBusMessage | null>(null);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('MessageBus: Already connected');
            return;
        }

        console.log(`MessageBus: Connecting to ${url}...`);

        try {
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('MessageBus: Connected');
                setIsConnected(true);
                setError(null);
            };

            ws.onmessage = (event) => {
                try {
                    const message: MessageBusMessage = JSON.parse(event.data);
                    console.log('MessageBus: Received', message);
                    setLastMessage(message);

                    // Handle intent messages (legacy format)
                    if (message.type?.startsWith('intent:')) {
                        const intentName = message.type.replace('intent:', '');
                        onIntent?.(intentName, message.data || {});
                    }

                    // Handle action:executed messages (new format)
                    if (message.type === 'action:executed') {
                        const action = message.data?.action;
                        if (action?.action) {
                            console.log('Action executed:', action.action, action.data);
                            // Map new action format to legacy intent format
                            if (action.action === 'open_app') {
                                onIntent?.('open_app', action.data || {});
                            } else if (action.action === 'close_app') {
                                onIntent?.('close_app', action.data || {});
                            } else if (action.action === 'speak') {
                                console.log('Backend says:', action.data?.text);
                            }
                        }
                    }
                } catch (e) {
                    console.error('MessageBus: Failed to parse message', e);
                }
            };

            ws.onclose = (event) => {
                console.log('MessageBus: Connection closed', event.code, event.reason);
                setIsConnected(false);
                wsRef.current = null;

                // Auto-reconnect after 3 seconds
                if (autoConnect && !reconnectTimeoutRef.current) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectTimeoutRef.current = null;
                        connect();
                    }, 3000);
                }
            };

            ws.onerror = (event) => {
                console.error('MessageBus: Error', event);
                setError('WebSocket connection error');
            };

        } catch (e) {
            console.error('MessageBus: Failed to connect', e);
            setError('Failed to connect to MessageBus');
        }
    }, [url, autoConnect, onIntent]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setIsConnected(false);
    }, []);

    const send = useCallback((message: MessageBusMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('MessageBus: Sending', message);
            wsRef.current.send(JSON.stringify(message));
        } else {
            console.warn('MessageBus: Cannot send, not connected');
        }
    }, []);

    /**
     * Send a voice utterance to OVOS for intent processing
     */
    const sendUtterance = useCallback((text: string) => {
        send({
            type: 'recognizer_loop:utterance',
            data: {
                utterances: [text],
                lang: 'en-US'
            }
        });
    }, [send]);

    /**
     * Request TTS playback
     */
    const speak = useCallback((text: string) => {
        send({
            type: 'speak',
            data: {
                utterance: text
            }
        });
    }, [send]);

    // Auto-connect on mount
    useEffect(() => {
        if (autoConnect) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [autoConnect, connect, disconnect]);

    return {
        isConnected,
        lastMessage,
        error,
        connect,
        disconnect,
        send,
        sendUtterance,
        speak
    };
}

export default useMessageBus;
