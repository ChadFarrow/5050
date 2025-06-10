# Nostr Wallet Connect (NWC) MCP Server Setup Guide

This guide will help you set up the Alby NWC MCP server to enable Lightning payments in your Nostr application.

## Overview

Your app already has comprehensive NWC integration built in, including:
- ✅ Direct NWC connection via WebSocket
- ✅ MCP server integration for enhanced performance
- ✅ Automatic fallback between MCP and direct connection
- ✅ Built-in diagnostics and troubleshooting tools
- ✅ Support for multiple wallet providers

## Quick Start

### Option 1: HTTP Server (Recommended for Web Apps)

This is the simplest method for web applications due to browser CORS restrictions.

```bash
# Method 1: Use project scripts (recommended - avoids global install)
cp .env.example .env
# Edit .env and add your NWC connection string
npm run mcp:start

# Method 2: Direct NPX (no global install needed)
NWC_CONNECTION_STRING="your_nwc_connection_string" npx @getalby/nwc-mcp-server --http --port 3000

# Method 3: Shell script
NWC_CONNECTION_STRING="your_nwc_connection_string" ./scripts/start-mcp-server.sh
```

Then in your app:
1. Go to Lightning Configuration
2. Connect your NWC wallet
3. Open Advanced Settings
4. Enable MCP Server
5. Set Server URL to: `http://localhost:3000`

### Option 2: Claude Desktop Integration

Add this to your Claude Desktop config file (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nwc": {
      "command": "npx",
      "args": ["-y", "@getalby/nwc-mcp-server"],
      "env": {
        "NWC_CONNECTION_STRING": "your_nwc_connection_string_here"
      }
    }
  }
}
```

### Option 3: Direct NPX (Development)

```bash
NWC_CONNECTION_STRING="your_nwc_connection_string" npx @getalby/nwc-mcp-server --http --port 3000
```

## Getting Your NWC Connection String

### Alby Wallet
1. Open [Alby](https://getalby.com)
2. Go to Settings → Developer Settings
3. Enable "Nostr Wallet Connect"
4. Generate a new connection with `make_invoice` permission
5. Copy the connection string starting with `nostr+walletconnect://`

### Mutiny Wallet
1. Open [Mutiny Wallet](https://mutinywallet.com)
2. Go to Settings → Nostr Wallet Connect
3. Create a new connection
4. Enable invoice creation permissions
5. Copy the connection string

### Other Compatible Wallets
- Umbrel
- LND with NWC support
- Any wallet implementing NIP-47

## Troubleshooting

### Connection Issues

The app includes comprehensive diagnostic tools:

1. **Connection Diagnostics**: Tests all aspects of your NWC setup
2. **Quick Invoice Test**: Creates a test invoice in 10 seconds
3. **Relay Connection Test**: Verifies WebSocket connectivity
4. **Direct NWC Test**: Bypasses MCP to test direct connection
5. **MCP Server Test**: Checks if MCP server is reachable

### Common Problems and Solutions

#### 1. "MCP server unreachable"
```bash
# Check if server is running
curl http://localhost:3000

# If not, start the server
NWC_CONNECTION_STRING="your_string" nwc-mcp-server --http --port 3000
```

#### 2. "CORS Policy Error"
- Use local MCP server instead of hosted version
- Don't use `mcp.getalby.com` directly from browser

#### 3. "Permission Denied" or "UNAUTHORIZED"
- Enable `make_invoice` permission in your wallet's NWC settings
- Regenerate the connection string with proper permissions

#### 4. "Connection timeout"
- Check if your wallet is online
- Test relay connection separately
- Try disabling MCP to use direct connection

#### 5. "WebSocket connection failed"
- Verify your wallet's relay is accessible
- Check browser console for detailed errors
- Try regenerating NWC connection string

### Fallback Strategy

If MCP server setup is too complex:
1. Disable MCP in Advanced Settings
2. Use direct NWC connection
3. This connects directly to your wallet's Nostr relay

## Advanced Configuration

### Custom MCP Server URL
You can run the MCP server on any port:
```bash
NWC_CONNECTION_STRING="your_string" nwc-mcp-server --http --port 8080
```
Then use `http://localhost:8080` in the app settings.

### Environment Variables
```bash
# Required
export NWC_CONNECTION_STRING="nostr+walletconnect://..."

# Optional
export PORT=3000
export HOST=localhost
```

### Docker Deployment
```bash
docker run -e NWC_CONNECTION_STRING="your_string" -p 3000:3000 getalby/nwc-mcp-server --http --port 3000
```

## Security Considerations

1. **Never share your NWC connection string** - it contains your wallet's private connection details
2. **Use proper permissions** - only enable `make_invoice` if you need to create invoices
3. **Local server only** - don't expose MCP server to the internet
4. **Regenerate regularly** - create new connection strings periodically

## Testing Your Setup

### Manual Test
1. Start MCP server
2. Connect wallet in the app
3. Enable MCP in Advanced Settings
4. Run diagnostics
5. Try creating a test invoice

### Command Line Test
```bash
# Test MCP server health (using project script)
npm run mcp:test

# Manual curl test
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"test","method":"tools/list","params":{}}'
```

## API Reference

### MCP Server Endpoints
- `GET /` - Health check
- `POST /` - JSON-RPC endpoint

### Supported NWC Methods
- `get_info` - Get wallet information
- `get_balance` - Get wallet balance
- `make_invoice` - Create Lightning invoice
- `pay_invoice` - Pay Lightning invoice

## Links

- [NWC MCP Server GitHub](https://github.com/getAlby/nwc-mcp-server)
- [NWC Protocol Documentation](https://nwc.dev)
- [Alby Wallet](https://getalby.com)
- [Mutiny Wallet](https://mutinywallet.com)

## Support

If you're still having issues:
1. Check browser console for detailed errors
2. Use the built-in diagnostic tools
3. Try the direct NWC connection mode
4. Verify your wallet permissions
5. Regenerate your NWC connection string