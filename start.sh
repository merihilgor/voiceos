#!/bin/bash

# Force use of Node v24
export PATH="/usr/local/Cellar/node/24.1.0/bin:$PATH"

# Verify node version
echo "Using Node version: $(node -v)"
echo "Using NPM version: $(npm -v)"

# Run the app
echo "Starting Juvenile (Voice AI OS)..."
npm run dev:all
