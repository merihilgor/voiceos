#!/bin/bash

# VoiceOS Unified Start Script
# Starts both OVOS backend and Frontend
# Press Ctrl+C to terminate all processes

# Force use of Node v24
export PATH="/usr/local/Cellar/node/24.1.0/bin:$PATH"

echo "╔══════════════════════════════════════╗"
echo "║  VoiceOS: Juvenile Release           ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Trap Ctrl+C to kill all child processes
cleanup() {
    echo ""
    echo "Shutting down..."
    kill 0
    exit 0
}
trap cleanup SIGINT SIGTERM

# Check Python environment for OVOS
if [ ! -d "backend/venv" ]; then
    echo "Setting up Python environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -q websockets
    cd ..
else
    source backend/venv/bin/activate
fi

echo "Using Node $(node -v) | Python $(python3 --version)"
echo ""

# Start OVOS MessageBus (background)
echo "Starting OVOS MessageBus on ws://localhost:8181..."
python backend/start_messagebus.py &
OVOS_PID=$!

# Give MessageBus time to start
sleep 1

# Start Frontend (foreground via npm)
echo "Starting Frontend on http://localhost:3000..."
npm run dev:all &
FRONTEND_PID=$!

echo ""
echo "✓ All services running. Press Ctrl+C to stop."
echo ""

# Wait for any process to exit
wait
