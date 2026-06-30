# Nyxora MCP Integration Guide

Nyxora natively supports the **Model Context Protocol (MCP)**, allowing external AI clients (like Claude Desktop or Cursor IDE) to securely interact with the Nyxora ecosystem.

Through this integration, your external AI can execute token swaps, request wallet addresses, and bridge assets without ever seeing your private keys. All transactions are securely routed through the Nyxora Policy Engine and Signer Vault.

## Prerequisites

The Nyxora MCP Server communicates with the Nyxora daemon through a highly secure, dynamically generated runtime token (`~/.nyxora/runtime.token`).

Therefore, **you must have the Nyxora daemon running** before you can use the MCP Server:

```bash
# If you installed Nyxora globally (Option 1 & 2):
nyxora start

# If you installed Nyxora from Source Code (Option 3):
npm start
```

*Ensure the daemon is running in the background. The MCP Server will automatically bridge to it.*
