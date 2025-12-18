import { WebSocketServer } from 'ws';
import mitt from 'mitt';

const wss = new WebSocketServer({ port: 8080 });
const emitter = mitt();

console.log('🔊 VoiceOS Message Bus running on port 8080');

wss.on('connection', function connection(ws) {
    console.log('Client connected');

    ws.on('error', console.error);

    ws.on('message', function message(data) {
        try {
            const parsed = JSON.parse(data);
            if (parsed.type && parsed.payload) {
                // Broadcast to all other clients
                console.log(`Received: ${parsed.type}`);
                wss.clients.forEach(function each(client) {
                    if (client !== ws && client.readyState === 1) { // WebSocket.OPEN
                        client.send(data, { binary: false });
                    }
                });

                // Emit locally for server-side logic
                emitter.emit(parsed.type, parsed.payload);
            }
        } catch (e) {
            console.error('Invalid message format', e);
        }
    });
});
