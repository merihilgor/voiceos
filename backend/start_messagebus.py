#!/usr/bin/env python3
"""
OVOS MessageBus Server
Provides WebSocket communication between React frontend and OVOS backend.
Runs on ws://localhost:8181
"""

import asyncio
import json
import logging
from datetime import datetime

try:
    import websockets
except ImportError:
    print("Installing websockets...")
    import subprocess
    subprocess.check_call(["pip", "install", "websockets"])
    import websockets

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Store connected clients
connected_clients = set()

# Mock intent patterns (no Gemini API)
INTENT_PATTERNS = {
    'open': {'intent': 'open_app', 'handler': 'openApp'},
    'close': {'intent': 'close_app', 'handler': 'closeApp'},
    'calculator': {'app': 'calculator'},
    'notes': {'app': 'notes'},
    'terminal': {'app': 'terminal'},
    'browser': {'app': 'browser'},
    'real': {'modifier': 'real'},
}


def parse_utterance(text: str) -> dict:
    """
    Mock intent parser - extracts intent from utterance without AI.
    """
    lower = text.lower()
    result = {
        'type': 'intent',
        'intent': None,
        'data': {},
        'utterance': text
    }
    
    # Detect action
    if 'open' in lower:
        result['intent'] = 'open_app'
    elif 'close' in lower:
        result['intent'] = 'close_app'
    elif 'switch' in lower or 'türkçe' in lower or 'english' in lower or 'ingilizce' in lower:
        result['intent'] = 'switch_language'
        if 'turkish' in lower or 'türkçe' in lower:
            result['data']['language'] = 'tr-TR'
        else:
            result['data']['language'] = 'en-US'
    else:
        result['intent'] = 'fallback'
        result['data']['response'] = f'I heard "{text}" but I don\'t know how to handle that yet.'
    
    # Detect target app
    for app in ['calculator', 'notes', 'terminal', 'browser', 'gallery', 'settings']:
        if app in lower:
            result['data']['app'] = app
            break
    
    # Detect "real" modifier
    if 'real' in lower:
        result['data']['real'] = True
        if result['data'].get('app'):
            result['data']['app'] = result['data']['app'].capitalize()  # "Calculator" for real macOS
    
    logger.info(f"Parsed intent: {result}")
    return result


async def handle_message(websocket, message: str):
    """Handle incoming WebSocket messages."""
    try:
        data = json.loads(message)
        msg_type = data.get('type', '')
        
        logger.info(f"Received: {msg_type} - {data}")
        
        if msg_type == 'recognizer_loop:utterance':
            # Voice input from frontend
            utterances = data.get('data', {}).get('utterances', [])
            if utterances:
                intent = parse_utterance(utterances[0])
                
                # Send intent back to frontend
                response = {
                    'type': 'intent:' + (intent['intent'] or 'unknown'),
                    'data': intent['data'],
                    'context': {
                        'timestamp': datetime.now().isoformat()
                    }
                }
                await websocket.send(json.dumps(response))
                logger.info(f"Sent: {response}")
        
        elif msg_type == 'speak':
            # TTS request - just log for now
            text = data.get('data', {}).get('utterance', '')
            logger.info(f"TTS Request: {text}")
        
        else:
            # Echo unknown messages
            logger.warning(f"Unknown message type: {msg_type}")
            
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON: {message}")
    except Exception as e:
        logger.error(f"Error handling message: {e}")


async def handler(websocket, path=None):
    """WebSocket connection handler."""
    connected_clients.add(websocket)
    client_id = id(websocket)
    logger.info(f"Client connected: {client_id} (Total: {len(connected_clients)})")
    
    try:
        # Send welcome message
        welcome = {
            'type': 'connected',
            'data': {
                'message': 'Connected to OVOS MessageBus',
                'version': '1.0.0-mock'
            }
        }
        await websocket.send(json.dumps(welcome))
        
        async for message in websocket:
            await handle_message(websocket, message)
            
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected: {client_id}")
    finally:
        connected_clients.discard(websocket)
        logger.info(f"Remaining clients: {len(connected_clients)}")


async def main():
    """Start the MessageBus WebSocket server."""
    host = "0.0.0.0"
    port = 8181
    
    logger.info(f"Starting OVOS MessageBus on ws://{host}:{port}")
    
    async with websockets.serve(handler, host, port):
        logger.info("MessageBus server running. Press Ctrl+C to stop.")
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped.")
