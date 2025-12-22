#!/bin/bash

# VoiceOS Unified Start Script
# Starts both OVOS backend and Frontend
# 
# Usage:
#   ./start.sh          - Full mode (requires GEMINI_API_KEY)
#   ./start.sh --mock   - Mock mode (no API key needed, local testing)
#   ./start.sh -m       - Same as --mock
#
# Press Ctrl+C to terminate all processes

set -e

# Parse arguments
MOCK_MODE=false
for arg in "$@"; do
    case $arg in
        --mock|-m)
            MOCK_MODE=true
            shift
            ;;
    esac
done

# Force use of Node v24
export PATH="/usr/local/Cellar/node/24.1.0/bin:$PATH"

# Banner
echo "╔══════════════════════════════════════════════════╗"
echo "║  VoiceOS: Juvenile Release                       ║"
if [ "$MOCK_MODE" = true ]; then
echo "║  Mode: MOCK (Local Testing)                      ║"
else
echo "║  Mode: FULL (Context-Aware + Gemini)             ║"
fi
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Trap Ctrl+C to kill all child processes
cleanup() {
    echo ""
    echo "Shutting down..."
    kill 0 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

# Check Python environment for OVOS
if [ ! -d "backend/venv" ]; then
    echo "Setting up Python environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -q -r requirements.txt
    cd ..
else
    source backend/venv/bin/activate
fi

# Check for API key in full mode
if [ "$MOCK_MODE" = false ]; then
    if [ -z "$GEMINI_API_KEY" ] && [ -f ".env.local" ]; then
        export $(grep -v '^#' .env.local | xargs)
    fi
    if [ -z "$GEMINI_API_KEY" ]; then
        echo "⚠️  GEMINI_API_KEY not set. Using fallback parser."
        echo "   Set it in .env.local or: export GEMINI_API_KEY=your-key"
        echo ""
    fi
fi

echo "Using Node $(node -v) | Python $(python3 --version)"
echo ""

# Start OVOS MessageBus (background)
if [ "$MOCK_MODE" = true ]; then
    echo "Starting MessageBus in MOCK mode (no Gemini)..."
    MOCK_MODE=true python backend/start_messagebus.py &
else
    echo "Starting MessageBus on ws://localhost:8181..."
    python backend/start_messagebus.py &
fi
OVOS_PID=$!

# Give MessageBus time to start
sleep 1

# Start Frontend
echo "Starting Frontend on http://localhost:5173..."
if [ "$MOCK_MODE" = true ]; then
    VITE_MOCK_MODE=true npm run dev &
else
    npm run dev &
fi
FRONTEND_PID=$!

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✓ All services running                          ║"
echo "║                                                  ║"
echo "║  Frontend:   http://localhost:5173               ║"
echo "║  MessageBus: ws://localhost:8181                 ║"
echo "║                                                  ║"
echo "║  Press Ctrl+C to stop all services               ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Wait for any process to exit
wait
