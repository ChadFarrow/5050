#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default configuration
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = 'localhost';

// Get environment variables
const connectionString = process.env.NWC_CONNECTION_STRING;
const port = process.env.PORT || DEFAULT_PORT;
const host = process.env.HOST || DEFAULT_HOST;

// Validate connection string
if (!connectionString) {
  console.error('❌ Error: NWC_CONNECTION_STRING environment variable is required');
  console.log('\n📋 Usage:');
  console.log('NWC_CONNECTION_STRING="nostr+walletconnect://..." node scripts/start-mcp-server.js');
  console.log('\n💡 Or create a .env file with:');
  console.log('NWC_CONNECTION_STRING=your_connection_string_here');
  process.exit(1);
}

if (!connectionString.startsWith('nostr+walletconnect://')) {
  console.error('❌ Error: Invalid NWC connection string format');
  console.log('Expected format: nostr+walletconnect://...');
  process.exit(1);
}

console.log('🚀 Starting Alby NWC MCP Server...');
console.log(`📡 Host: ${host}`);
console.log(`🔌 Port: ${port}`);
console.log(`🔗 Connection: ${connectionString.slice(0, 40)}...`);
console.log('');

// Create a temporary script to run the server
const tempScript = `
import "websocket-polyfill";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { nwc } from "@getalby/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetInfoTool } from "./tools/get_info.js";
import { registerMakeInvoiceTool } from "./tools/make_invoice.js";
import { registerPayInvoiceTool } from "./tools/pay_invoice.js";
import { registerGetBalanceTool } from "./tools/get_balance.js";
import { registerGetWalletServiceInfoTool } from "./tools/get_wallet_service_info.js";
import { registerLookupInvoiceTool } from "./tools/lookup_invoice.js";

const NWC_CONNECTION_STRING = "${connectionString}";

class NWCServer {
  _server;
  _client;
  constructor() {
    this._server = new McpServer({
      name: "nwc-mcp-server",
      version: "1.0.0",
    }, {});
    try {
      this._client = new nwc.NWCClient({
        nostrWalletConnectUrl: NWC_CONNECTION_STRING,
      });
    } catch (error) {
      throw new McpError(ErrorCode.InternalError, \`Failed to connect to NWC wallet: \${error instanceof Error ? error.message : String(error)}\`);
    }
    registerGetWalletServiceInfoTool(this._server, this._client);
    registerGetInfoTool(this._server, this._client);
    registerMakeInvoiceTool(this._server, this._client);
    registerPayInvoiceTool(this._server, this._client);
    registerGetBalanceTool(this._server, this._client);
    registerLookupInvoiceTool(this._server, this._client);
  }
  async run() {
    const transport = new HttpServerTransport({
      port: ${port},
      host: "${host}"
    });
    await this._server.connect(transport);
    console.log(\`✅ Server running at http://\${"${host}"}:\${${port}}\`);
  }
}

new NWCServer().run().catch(console.error);
`;

// Write the temporary script to a file
const tempScriptPath = path.join(__dirname, 'temp-server.js');
await fs.promises.writeFile(tempScriptPath, tempScript);

// Start the MCP server
const child = spawn('node', [
  tempScriptPath
], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    DEBUG: '*'
  },
  stdio: 'inherit'
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down MCP server...');
  child.kill('SIGINT');
  // Clean up the temporary script
  fs.unlinkSync(tempScriptPath);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down MCP server...');
  child.kill('SIGTERM');
  // Clean up the temporary script
  fs.unlinkSync(tempScriptPath);
});

child.on('error', (error) => {
  console.error('❌ Failed to start MCP server:', error.message);
  console.error('Full error:', error);
  // Clean up the temporary script
  fs.unlinkSync(tempScriptPath);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('✅ MCP server stopped cleanly');
  } else {
    console.error(`❌ MCP server exited with code ${code}`);
  }
  // Clean up the temporary script
  fs.unlinkSync(tempScriptPath);
  process.exit(code);
});