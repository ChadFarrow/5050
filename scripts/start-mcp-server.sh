#!/bin/bash

# Alby NWC MCP Server Startup Script
# Usage: ./scripts/start-mcp-server.sh

set -e

# Default configuration
DEFAULT_PORT=3000
DEFAULT_HOST="localhost"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get configuration
PORT=${PORT:-$DEFAULT_PORT}
HOST=${HOST:-$DEFAULT_HOST}

echo -e "${BLUE}🚀 Starting Alby NWC MCP Server...${NC}"

# Check if NWC_CONNECTION_STRING is set
if [ -z "$NWC_CONNECTION_STRING" ]; then
    echo -e "${RED}❌ Error: NWC_CONNECTION_STRING environment variable is required${NC}"
    echo ""
    echo -e "${YELLOW}📋 Usage:${NC}"
    echo "NWC_CONNECTION_STRING=\"nostr+walletconnect://...\" ./scripts/start-mcp-server.sh"
    echo ""
    echo -e "${YELLOW}💡 Or export the variable:${NC}"
    echo "export NWC_CONNECTION_STRING=\"your_connection_string_here\""
    echo "./scripts/start-mcp-server.sh"
    echo ""
    echo -e "${YELLOW}🔗 How to get a connection string:${NC}"
    echo "1. Open Alby wallet (https://getalby.com)"
    echo "2. Go to Settings → Developer Settings"
    echo "3. Enable Nostr Wallet Connect"
    echo "4. Generate connection with 'make_invoice' permission"
    echo "5. Copy the connection string"
    exit 1
fi

# Validate connection string format
if [[ ! "$NWC_CONNECTION_STRING" =~ ^nostr\+walletconnect:// ]]; then
    echo -e "${RED}❌ Error: Invalid NWC connection string format${NC}"
    echo "Expected format: nostr+walletconnect://..."
    exit 1
fi

echo -e "${GREEN}📡 Host: $HOST${NC}"
echo -e "${GREEN}🔌 Port: $PORT${NC}"
echo -e "${GREEN}🔗 Connection: ${NWC_CONNECTION_STRING:0:40}...${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down MCP server...${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start the MCP server
echo -e "${BLUE}⚡ Starting server...${NC}"
echo ""

NWC_CONNECTION_STRING="$NWC_CONNECTION_STRING" \
PORT="$PORT" \
HOST="$HOST" \
npx @getalby/nwc-mcp-server --http --port "$PORT" --host "$HOST"