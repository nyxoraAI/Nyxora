// MCP Server uses Stdio, so we avoid global hooks that might write to stdout.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import http from 'http';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const tokenPath = path.join(os.homedir(), '.nyxora', 'auth', 'runtime.token');
let JWT_SECRET = '';
try {
  JWT_SECRET = fs.readFileSync(tokenPath, 'utf8').trim();
} catch (e) {
  console.error("Could not read ~/.nyxora/auth/runtime.token");
  process.exit(1);
}

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkgVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;

const server = new McpServer({
  name: "Nyxora MCP Server",
  version: pkgVersion
});

// Helper to make internal requests to Policy Engine
function callPolicyEngine(apiPath: string, method: string, payload?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (payload && apiPath === '/request-tx') {
      const amountWei = payload.details?.amountWei || '';
      payload.internalSignature = crypto.createHmac('sha256', JWT_SECRET as string)
        .update(payload.chainName + amountWei)
        .digest('hex');
    }

    const dataString = payload ? JSON.stringify(payload) : '';
    
    const options = {
      socketPath: '/tmp/nyxora-policy.sock',
      path: apiPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt.sign({ service: 'mcp-server' }, JWT_SECRET as string, { expiresIn: '1m' })}`,
        'Content-Length': Buffer.byteLength(dataString)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Policy Engine Rejected (${res.statusCode}): ${parsed.error || parsed.message || data}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse Policy Engine response: ${data}`));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`Policy Engine Connection Error: ${e.message}`)));
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Policy Engine Connection Timeout'));
    });
    
    if (dataString) {
      req.write(dataString);
    }
    req.end();
  });
}

// Tool: get_wallet_address
server.tool(
  "get_wallet_address",
  "Fetch the secure Ethereum wallet address managed by the Nyxora Signer Vault. Use this to know the agent's identity.",
  {},
  async () => {
    try {
      const response = await callPolicyEngine('/address', 'GET');
      return {
        content: [{ type: "text" as const, text: `Wallet Address: ${response.address}` }]
      };
    } catch (e: any) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: e.message }]
      };
    }
  }
);

// Tool: request_transaction
server.tool(
  "request_transaction",
  "Request an EVM transaction (transfer, swap, bridge). This will be evaluated by the Policy Engine. If approved, it returns a pending Transaction ID.",
  {
    type: z.enum(['transfer', 'swap', 'bridge', 'mint', 'custom']).describe("The type of transaction"),
    chainName: z.string().describe("The target blockchain network (e.g. 'ethereum', 'base', 'arbitrum')"),
    details: z.string().describe("JSON string payload. For 'transfer': { to: string, amountWei: string }. For 'swap': { tokenIn: string, tokenOut: string, amountInWei: string }.")
  } as any,
  async (args: any) => {
    try {
      // Parse details back to object since it's passed as string
      if (typeof args.details === 'string') {
        args.details = JSON.parse(args.details);
      }
      const response = await callPolicyEngine('/request-tx', 'POST', args);
      return {
        content: [{ type: "text" as const, text: `Transaction requested successfully. Transaction ID: ${response.id}. Status: ${response.status}` }]
      };
    } catch (e: any) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Transaction Request Failed! ${e.message}` }]
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Nyxora MCP Server running on stdio"); // stdio logs use stderr so stdout is purely for MCP JSON-RPC
}

main().catch((error) => {
  console.error("Fatal error in MCP Server:", error);
  process.exit(1);
});
