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

# Single Instance Lock - Ensure only one VoiceOS is running
LOCK_FILE="/tmp/voiceos.lock"
LOCK_PID=""

if [ -f "$LOCK_FILE" ]; then
    LOCK_PID=$(cat "$LOCK_FILE")
    if ps -p "$LOCK_PID" > /dev/null 2>&1; then
        echo "❌ ERROR: VoiceOS is already running (PID: $LOCK_PID)"
        echo "   To stop it: kill $LOCK_PID"
        echo "   Or remove lock: rm $LOCK_FILE"
        exit 1
    else
        echo "⚠️  Stale lock file found. Cleaning up..."
        rm -f "$LOCK_FILE"
    fi
fi

# Write our PID to lock file
echo $$ > "$LOCK_FILE"
echo "🔒 Single instance lock acquired (PID: $$)"

# Trap Ctrl+C to kill all child processes and remove lock
cleanup() {
    echo ""
    echo "Shutting down..."
    rm -f "$LOCK_FILE"
    kill 0 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

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
    if [ -f ".env.local" ]; then
        export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
    fi
    
    # Determine LLM provider
    LLM_PROVIDER=${LLM_PROVIDER:-gemini}
    echo "LLM Provider: $LLM_PROVIDER"
    
    if [ "$LLM_PROVIDER" = "ollama" ]; then
        if [ -z "$OLLAMA_API_KEY" ]; then
            echo "⚠️  OLLAMA_API_KEY not set. Using fallback parser."
            echo "   Set it in .env.local or: export OLLAMA_API_KEY=your-key"
            echo ""
        fi
    else
        if [ -z "$GEMINI_API_KEY" ]; then
            echo "⚠️  GEMINI_API_KEY not set. Using fallback parser."
            echo "   Set it in .env.local or: export GEMINI_API_KEY=your-key"
            echo ""
        fi
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

# Start Node.js API Server (handles /api/execute for macOS commands)
echo "Starting API Server on http://localhost:3001..."
LLM_PROVIDER="$LLM_PROVIDER" LLM_MODEL="$LLM_MODEL" GEMINI_API_KEY="$GEMINI_API_KEY" OLLAMA_API_KEY="$OLLAMA_API_KEY" OLLAMA_BASE_URL="$OLLAMA_BASE_URL" node server/index.js &
API_PID=$!

# Give API server time to start
sleep 1

# Start Frontend
echo "Starting Frontend on http://localhost:3000..."
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
echo "║  Frontend:   http://localhost:3000               ║"
echo "║  API Server: http://localhost:3001               ║"
echo "║  MessageBus: ws://localhost:8181                 ║"
echo "║                                                  ║"
echo "║  Press Ctrl+C to stop all services               ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Wait for any process to exit
wait
