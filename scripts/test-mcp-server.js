#!/usr/bin/env node

import http from 'http';

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = 'localhost';

const port = process.env.PORT || DEFAULT_PORT;
const host = process.env.HOST || DEFAULT_HOST;
const url = `http://${host}:${port}`;

console.log(`🔍 Testing MCP server at ${url}...`);

// Test 1: Basic health check
function testHealthCheck() {
  return new Promise((resolve) => {
    const req = http.request(`${url}/`, { method: 'GET', timeout: 5000 }, (res) => {
      console.log(`✅ Health check: ${res.statusCode} ${res.statusMessage}`);
      resolve({ success: true, status: res.statusCode });
    });

    req.on('error', (error) => {
      console.log(`❌ Health check failed: ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.log('❌ Health check timed out');
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.end();
  });
}

// Test 2: JSON-RPC endpoint
function testJsonRpc() {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      id: 'health-check',
      method: 'tools/list',
      params: {}
    });

    const options = {
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`✅ JSON-RPC test: ${res.statusCode} ${res.statusMessage}`);
          if (response.error) {
            console.log(`   Response error: ${response.error.message}`);
          } else {
            console.log(`   Response: ${JSON.stringify(response).slice(0, 100)}...`);
          }
          resolve({ success: true, status: res.statusCode, response });
        } catch (error) {
          console.log(`❌ JSON-RPC test: Invalid JSON response`);
          console.log(`   Raw response: ${data.slice(0, 200)}...`);
          resolve({ success: false, error: 'Invalid JSON' });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ JSON-RPC test failed: ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.log('❌ JSON-RPC test timed out');
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.write(postData);
    req.end();
  });
}

// Main test function
async function runTests() {
  console.log('🚀 Starting MCP server tests...\n');

  const healthResult = await testHealthCheck();
  const rpcResult = await testJsonRpc();

  console.log('\n📊 Test Results:');
  console.log(`Health Check: ${healthResult.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`JSON-RPC Test: ${rpcResult.success ? '✅ PASS' : '❌ FAIL'}`);

  if (!healthResult.success && !rpcResult.success) {
    console.log('\n❌ MCP server appears to be down or unreachable');
    console.log('💡 Try starting it with: npm run mcp:start');
  } else if (healthResult.success || rpcResult.success) {
    console.log('\n✅ MCP server is running and responding');
    console.log(`🔗 Configure your app to use: ${url}`);
  }

  process.exit(healthResult.success || rpcResult.success ? 0 : 1);
}

runTests().catch(console.error);