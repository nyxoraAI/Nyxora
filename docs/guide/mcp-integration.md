# Nyxora MCP Integration Guide

Nyxora natively supports the **Model Context Protocol (MCP)**, allowing external AI clients (like Claude Desktop or Cursor IDE) to securely interact with the Nyxora ecosystem.

Through this integration, your external AI can execute token swaps, request wallet addresses, and bridge assets without ever seeing your private keys. All transactions are securely routed through the Nyxora Policy Engine and Signer Vault.

## Prerequisites

The Nyxora MCP Server communicates with the Nyxora daemon through a highly secure, dynamically generated runtime token (`~/.nyxora/runtime.token`).

Therefore, **you must have the Nyxora daemon running** before you can use the MCP Server:

```bash
npm start
```

*Ensure the daemon is running in the background. The MCP Server will automatically bridge to it.*

## Claude Desktop Configuration

To connect Claude Desktop to Nyxora, you need to add Nyxora as an MCP Server in your Claude configuration file.

1. Open your Claude Desktop configuration file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the following JSON snippet to the `mcpServers` object (adjust the absolute path to point to your Nyxora repository):

```json
{
  "mcpServers": {
    "nyxora": {
      "command": "npx",
      "args": [
        "ts-node",
        "/absolute/path/to/nyxora/packages/mcp-server/src/server.ts"
      ]
    }
  }
}
```

3. **Restart Claude Desktop**. You will now see a new "plug" icon or Nyxora tools available in your Claude chat!

## Cursor IDE Configuration

If you are using the Cursor IDE and want its AI features to interact with Nyxora:

1. Open Cursor Settings.
2. Navigate to **Features** > **MCP Servers**.
3. Click **Add New MCP Server**.
4. Set the Type to `command`.
5. Set the Name to `nyxora`.
6. Set the Command to: `npx ts-node /absolute/path/to/nyxora/packages/mcp-server/src/server.ts`
7. Click Save and Refresh.

## Available Capabilities

Once connected, your AI client will have access to:
- **`get_wallet_address`**: Securely retrieves the EVM wallet address managed by the Signer Vault.
- **`request_transaction`**: Requests EVM operations (like `swap` or `transfer`). The Policy Engine evaluates the request and if approved, signs and broadcasts it.

> **Security Note**: External AI clients never touch your private keys. They only interface with the standard MCP API, which is strictly governed by your Nyxora `policy.yaml` rules.
