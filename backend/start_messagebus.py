#!/usr/bin/env python3
"""
OVOS MessageBus Server - Context-Aware Version
Provides WebSocket communication between React frontend and OVOS backend.
Runs on ws://localhost:8181

This version integrates:
- Context Tracker: Knows which app is focused
- Intent Parser: Gemini-based command interpretation
- Action Executor: Sends keystrokes/commands to macOS
"""

import asyncio
import json
import logging
import os
from datetime import datetime

try:
    import websockets
except ImportError:
    print("Installing websockets...")
    import subprocess
    subprocess.check_call(["pip", "install", "websockets"])
    import websockets

# Import our modules
from context_tracker import get_tracker
from intent_parser import get_parser
from action_executor import get_executor

# Try to import wake word listener (optional)
try:
    from wake_word_listener import get_listener as get_wake_listener
    WAKE_WORD_AVAILABLE = True
except ImportError:
    WAKE_WORD_AVAILABLE = False

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Store connected clients
connected_clients = set()

# Initialize components
context_tracker = get_tracker()
intent_parser = get_parser(os.environ.get("GEMINI_API_KEY"))
action_executor = get_executor()


async def broadcast(message: dict):
    """Broadcast a message to all connected clients."""
    if connected_clients:
        await asyncio.gather(
            *[client.send(json.dumps(message)) for client in connected_clients],
            return_exceptions=True
        )


async def send_context_update(websocket):
    """Send the current context to a client."""
    context = context_tracker.get_focused_app()
    context["type"] = context_tracker.get_app_type()
    
    await websocket.send(json.dumps({
        "type": "context:update",
        "data": context,
        "timestamp": datetime.now().isoformat()
    }))


async def handle_utterance(websocket, utterance: str):
    """Process a voice utterance through the full pipeline."""
    
    # 1. Get current context
    context = context_tracker.get_focused_app()
    context["type"] = context_tracker.get_app_type()
    
    logger.info(f"Processing utterance: '{utterance}' in context: {context['name']}")
    
    # 2. Parse intent with Gemini
    action = await intent_parser.parse(utterance, context)
    
    # 3. Execute action
    result = action_executor.execute(action)
    
    # 4. Send response back
    response = {
        "type": "action:executed",
        "data": {
            "utterance": utterance,
            "context": context,
            "action": action,
            "result": result
        },
        "timestamp": datetime.now().isoformat()
    }
    
    await websocket.send(json.dumps(response))
    logger.info(f"Executed: {action['action']} -> {result.get('success', False)}")
    
    # If action was speak, also send TTS message
    if action.get("action") == "speak":
        await websocket.send(json.dumps({
            "type": "speak",
            "data": {"utterance": action.get("data", {}).get("text", "")},
            "timestamp": datetime.now().isoformat()
        }))
    
    # Send updated context (app may have changed)
    await asyncio.sleep(0.5)  # Wait for app switch
    await send_context_update(websocket)


async def handle_message(websocket, message: str):
    """Handle incoming WebSocket messages."""
    try:
        data = json.loads(message)
        msg_type = data.get('type', '')
        
        logger.info(f"Received: {msg_type}")
        
        if msg_type == 'recognizer_loop:utterance':
            # Voice input from frontend
            utterances = data.get('data', {}).get('utterances', [])
            if utterances:
                await handle_utterance(websocket, utterances[0])
        
        elif msg_type == 'context:request':
            # Client requesting current context
            await send_context_update(websocket)
        
        elif msg_type == 'speak':
            # TTS request - execute it
            text = data.get('data', {}).get('utterance', '')
            if text:
                result = action_executor.execute({
                    "action": "speak",
                    "data": {"text": text}
                })
                logger.info(f"TTS: {text} -> {result}")
        
        elif msg_type == 'action:execute':
            # Direct action execution (for testing)
            action = data.get('data', {})
            result = action_executor.execute(action)
            await websocket.send(json.dumps({
                "type": "action:result",
                "data": result,
                "timestamp": datetime.now().isoformat()
            }))
        
        else:
            logger.warning(f"Unknown message type: {msg_type}")
            
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON: {message}")
    except Exception as e:
        logger.error(f"Error handling message: {e}", exc_info=True)


async def context_polling_task(websocket):
    """Periodically send context updates to clients."""
    last_context = None
    while True:
        try:
            context = context_tracker.get_focused_app()
            context["type"] = context_tracker.get_app_type()
            
            # Only send if context changed
            if context.get("name") != last_context:
                await websocket.send(json.dumps({
                    "type": "context:update",
                    "data": context,
                    "timestamp": datetime.now().isoformat()
                }))
                last_context = context.get("name")
            
            await asyncio.sleep(1)  # Poll every second
        except websockets.exceptions.ConnectionClosed:
            break
        except Exception as e:
            logger.error(f"Context polling error: {e}")
            await asyncio.sleep(1)


async def handler(websocket, path=None):
    """WebSocket connection handler."""
    connected_clients.add(websocket)
    client_id = id(websocket)
    logger.info(f"Client connected: {client_id} (Total: {len(connected_clients)})")
    
    # Start context polling for this client
    polling_task = asyncio.create_task(context_polling_task(websocket))
    
    try:
        # Send welcome message
        welcome = {
            'type': 'connected',
            'data': {
                'message': 'Connected to OVOS MessageBus (Context-Aware)',
                'version': '2.0.0',
                'features': ['context_tracking', 'llm_intent', 'action_execution']
            }
        }
        await websocket.send(json.dumps(welcome))
        
        # Send initial context
        await send_context_update(websocket)
        
        async for message in websocket:
            await handle_message(websocket, message)
            
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected: {client_id}")
    finally:
        polling_task.cancel()
        connected_clients.discard(websocket)
        logger.info(f"Remaining clients: {len(connected_clients)})")


async def main():
    """Start the MessageBus WebSocket server."""
    host = "0.0.0.0"
    port = 8181
    
    logger.info(f"Starting OVOS MessageBus (Context-Aware) on ws://{host}:{port}")
    logger.info(f"Gemini API Key: {'configured' if os.environ.get('GEMINI_API_KEY') else 'NOT SET'}")
    
    # Start wake word listener if available
    if WAKE_WORD_AVAILABLE:
        def on_wake_word():
            """Handle wake word detection."""
            logger.info("Wake word 'Holo' detected!")
            # Broadcast to all clients
            asyncio.run_coroutine_threadsafe(
                broadcast({
                    "type": "wake_word:detected",
                    "data": {"wake_word": "holo"},
                    "timestamp": datetime.now().isoformat()
                }),
                asyncio.get_event_loop()
            )
        
        wake_listener = get_wake_listener(callback=on_wake_word)
        if wake_listener.start():
            logger.info("Wake word listener started (say 'Holo' to activate)")
        else:
            logger.warning("Wake word listener failed to start")
    else:
        logger.info("Wake word listener not available (install openwakeword pyaudio)")
    
    async with websockets.serve(handler, host, port):
        logger.info("MessageBus server running. Press Ctrl+C to stop.")
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped.")
