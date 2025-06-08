/**
 * Example Node.js server to integrate with Alby's NWC MCP Server
 * This would typically run as a separate backend service
 * 
 * To use this:
 * 1. npm install express @modelcontextprotocol/sdk
 * 2. npm install -g @getalby/nwc-mcp-server
 * 3. Set NWC_CONNECTION_STRING environment variable
 * 4. Run: node api-server-example.js
 */

const express = require('express');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Store MCP clients per connection string
const mcpClients = new Map();

async function getMCPClient(connectionString) {
  if (mcpClients.has(connectionString)) {
    return mcpClients.get(connectionString);
  }

  try {
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['@getalby/nwc-mcp-server'],
      env: {
        ...process.env,
        NWC_CONNECTION_STRING: connectionString,
      },
    });

    const client = new Client(
      {
        name: 'podraffle-nwc-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    await client.connect(transport);
    
    const clientWrapper = {
      client,
      transport,
      lastUsed: Date.now(),
    };

    mcpClients.set(connectionString, clientWrapper);
    
    // Clean up old clients after 5 minutes of inactivity
    setTimeout(() => {
      const wrapper = mcpClients.get(connectionString);
      if (wrapper && Date.now() - wrapper.lastUsed > 300000) {
        wrapper.client.close();
        wrapper.transport.close();
        mcpClients.delete(connectionString);
      }
    }, 300000);

    return clientWrapper;
  } catch (error) {
    console.error('Failed to create MCP client:', error);
    throw error;
  }
}

async function callNWCMethod(connectionString, method, params = {}) {
  try {
    const clientWrapper = await getMCPClient(connectionString);
    clientWrapper.lastUsed = Date.now();

    const result = await clientWrapper.client.callTool({
      name: method,
      arguments: params,
    });

    if (result.content && result.content[0] && result.content[0].type === 'text') {
      return JSON.parse(result.content[0].text);
    }

    return { error: { code: 'INTERNAL', message: 'Invalid response format' } };
  } catch (error) {
    console.error(`NWC ${method} error:`, error);
    return {
      error: {
        code: 'INTERNAL',
        message: error.message || 'Unknown error',
      },
    };
  }
}

// NWC API endpoints
app.post('/api/nwc/make_invoice', async (req, res) => {
  const { connection_string, amount, description, expiry } = req.body;

  if (!connection_string) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'connection_string required' },
    });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Valid amount required' },
    });
  }

  const result = await callNWCMethod(connection_string, 'make_invoice', {
    amount,
    description: description || '',
    expiry: expiry || 3600,
  });

  res.json(result);
});

app.post('/api/nwc/pay_invoice', async (req, res) => {
  const { connection_string, invoice, amount } = req.body;

  if (!connection_string) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'connection_string required' },
    });
  }

  if (!invoice) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'invoice required' },
    });
  }

  const result = await callNWCMethod(connection_string, 'pay_invoice', {
    invoice,
    amount,
  });

  res.json(result);
});

app.post('/api/nwc/get_balance', async (req, res) => {
  const { connection_string } = req.body;

  if (!connection_string) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'connection_string required' },
    });
  }

  const result = await callNWCMethod(connection_string, 'get_balance');
  res.json(result);
});

app.post('/api/nwc/get_info', async (req, res) => {
  const { connection_string } = req.body;

  if (!connection_string) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'connection_string required' },
    });
  }

  const result = await callNWCMethod(connection_string, 'get_info');
  res.json(result);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`NWC MCP API Server running on port ${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /api/nwc/make_invoice');
  console.log('  POST /api/nwc/pay_invoice');
  console.log('  POST /api/nwc/get_balance');
  console.log('  POST /api/nwc/get_info');
  console.log('  GET  /health');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  
  // Close all MCP clients
  for (const [connectionString, wrapper] of mcpClients) {
    try {
      await wrapper.client.close();
      await wrapper.transport.close();
    } catch (error) {
      console.error(`Error closing client for ${connectionString}:`, error);
    }
  }
  
  process.exit(0);
});

module.exports = app;