# NWC MCP Server Integration Setup

This guide shows how to integrate the Alby NWC MCP Server for reliable Lightning payments in PodRaffle.

## Overview

The [Alby NWC MCP Server](https://github.com/getalby/nwc-mcp-server) provides a Model Context Protocol (MCP) interface for Nostr Wallet Connect operations. This allows reliable Lightning invoice generation and payment processing through a standardized protocol.

## ✅ What's Implemented

- **MCP Client Integration**: Complete client for communicating with the NWC MCP server
- **Browser Compatibility**: HTTP proxy for browser environments
- **Fallback System**: Multiple layers of fallback (MCP → Alby SDK → Manual Relay)
- **API Server Template**: Ready-to-deploy backend service
- **Type Safety**: Full TypeScript support with proper error handling

## 🚀 Quick Setup

### 1. Install the NWC MCP Server

```bash
npm install -g @getalby/nwc-mcp-server
```

### 2. Set Up Backend API Server

Use the provided `api-server-example.js`:

```bash
# Install dependencies
npm install express @modelcontextprotocol/sdk cors

# Set environment variables
export NWC_CONNECTION_STRING="nostr+walletconnect://..."

# Run the server
node api-server-example.js
```

### 3. Configure Frontend

Add environment variable to your `.env.local`:

```env
VITE_NWC_WS_URL=ws://localhost:3001/nwc
```

### 4. Test the Integration

```typescript
import { createNWCClient } from './src/lib/nwc-mcp-client';

const client = createNWCClient({
  connectionString: 'nostr+walletconnect://...',
  wsUrl: 'ws://localhost:3001/nwc'
});

await client.initialize();
const balance = await client.getBalance();
console.log('Wallet balance:', balance);
```

## 📋 Architecture

### Frontend (Browser)
```
PodRaffle App
    ↓
BrowserNWCClient (HTTP)
    ↓
API Server (/api/nwc/*)
```

### Backend (Node.js)
```
API Server
    ↓
MCP Client
    ↓
NWC MCP Server
    ↓
Lightning Wallet
```

## 🔧 API Endpoints

The backend server provides these endpoints:

### `POST /api/nwc/make_invoice`
Generate Lightning invoices for ticket purchases.

```json
{
  "connection_string": "nostr+walletconnect://...",
  "amount": 10000,
  "description": "PodRaffle tickets",
  "expiry": 3600
}
```

### `POST /api/nwc/pay_invoice`
Pay Lightning invoices (for user wallets).

```json
{
  "connection_string": "nostr+walletconnect://...",
  "invoice": "lnbc10u1p..."
}
```

### `POST /api/nwc/get_balance`
Check wallet balance.

```json
{
  "connection_string": "nostr+walletconnect://..."
}
```

### `POST /api/nwc/get_info`
Get wallet information and capabilities.

```json
{
  "connection_string": "nostr+walletconnect://..."
}
```

## 🔄 Payment Flow

### Campaign Creation
1. **Creator** enters NWC connection string
2. **App** validates connection format
3. **App** encrypts connection with NIP-44
4. **App** stores encrypted connection in campaign event

### Ticket Purchase
1. **Buyer** selects tickets and clicks buy
2. **App** retrieves encrypted NWC connection from campaign
3. **App** sends invoice request to API server
4. **API Server** uses MCP to communicate with creator's wallet
5. **Creator's Wallet** generates Lightning invoice
6. **Buyer** pays invoice through WebLN wallet
7. **App** publishes ticket event with payment proof

## 🔐 Security Features

- **Encrypted Storage**: NWC connections encrypted with NIP-44
- **API Validation**: Server validates all requests and parameters
- **Connection Isolation**: Each NWC connection runs in isolated MCP instance
- **Auto Cleanup**: Inactive connections automatically cleaned up
- **Error Handling**: Comprehensive error handling and logging

## 🏗️ Production Deployment

### Backend Server

Deploy the API server to a cloud provider:

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

# Install NWC MCP server globally
RUN npm install -g @getalby/nwc-mcp-server

COPY . .
EXPOSE 3001

CMD ["node", "api-server-example.js"]
```

### Environment Variables

```env
# Backend
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://your-podraffle-app.com

# Frontend
VITE_NWC_API_URL=https://your-api-server.com
```

### Health Monitoring

The API server includes a health endpoint:

```bash
curl https://your-api-server.com/health
```

## 🧪 Testing

### Test NWC Connection

```bash
# Test invoice generation
curl -X POST https://your-api-server.com/api/nwc/make_invoice \
  -H "Content-Type: application/json" \
  -d '{
    "connection_string": "nostr+walletconnect://...",
    "amount": 1000,
    "description": "Test invoice"
  }'
```

### Integration Tests

```typescript
// Example test
import { createNWCClient } from './src/lib/nwc-mcp-client';

describe('NWC MCP Integration', () => {
  it('should generate invoice', async () => {
    const client = createNWCClient({
      connectionString: process.env.TEST_NWC_CONNECTION,
    });
    
    await client.initialize();
    
    const response = await client.makeInvoice({
      amount: 1000,
      description: 'Test',
    });
    
    expect(response.result?.invoice).toBeDefined();
    expect(response.error).toBeUndefined();
  });
});
```

## 🎯 Benefits

### Reliability
- **MCP Protocol**: Standardized, reliable communication
- **Process Isolation**: Each wallet connection runs independently
- **Auto Recovery**: Automatic reconnection and error recovery

### Performance
- **Connection Pooling**: Reuse MCP connections for efficiency
- **Async Operations**: Non-blocking Lightning operations
- **Caching**: Cache wallet info and capabilities

### Developer Experience
- **Type Safety**: Full TypeScript support
- **Error Handling**: Comprehensive error types and messages
- **Testing**: Easy to test with mock implementations
- **Documentation**: Complete API documentation

## 🔧 Troubleshooting

### Common Issues

**MCP Server Not Found**
```bash
npm install -g @getalby/nwc-mcp-server
which npx # Ensure npx is available
```

**Connection Timeout**
```javascript
// Increase timeout in MCP client
const client = createNWCClient({
  connectionString: '...',
  timeout: 30000, // 30 seconds
});
```

**Invalid Connection String**
```javascript
// Validate before using
if (!isValidNWCConnection(connectionString)) {
  throw new Error('Invalid NWC connection format');
}
```

### Debug Mode

Enable debug logging:

```bash
DEBUG=mcp:* node api-server-example.js
```

## 📚 References

- [Alby NWC MCP Server](https://github.com/getalby/nwc-mcp-server)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [NIP-47 Specification](https://github.com/nostr-protocol/nips/blob/master/47.md)
- [Nostr Wallet Connect](https://nwc.getalby.com/)

## 🎉 Next Steps

1. **Deploy API Server** to your cloud provider
2. **Test Integration** with real NWC connections
3. **Monitor Performance** with logging and metrics
4. **Scale Horizontally** with load balancers as needed

The MCP integration provides enterprise-grade reliability for Lightning payments in PodRaffle!