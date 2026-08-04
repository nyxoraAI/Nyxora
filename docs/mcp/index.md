# Nyxora MCP Integration Guide

Nyxora natively supports the **Model Context Protocol (MCP)**, allowing external AI clients (like Claude Desktop or Cursor IDE) to securely interact with the Nyxora ecosystem.

Through this integration, your external AI can execute token swaps, request wallet addresses, and bridge assets without ever seeing your private keys. All transactions are securely routed through the Nyxora Policy Engine and Signer Vault.

## ✨ Prerequisites

The Nyxora MCP Server communicates with the Nyxora daemon through a highly secure, dynamically generated runtime token (`~/.nyxora/runtime.token`).

Therefore, **you must have the Nyxora daemon running** before you can use the MCP Server:

```bash
# If you installed Nyxora globally (Option 1 & 2):
nyxora start

# If you installed Nyxora from Source Code (Option 3):
npm start
```

*Ensure the daemon is running in the background. The MCP Server will automatically bridge to it.*

---

## 🔌 Building Custom MCP Plugins

Nyxora also allows you to inject new custom capabilities into the MCP Server by building your own plugins. This is especially useful for connecting enterprise internal APIs or private smart contracts so they can be accessed by the AI.

For a comprehensive step-by-step guide and code snippets on building custom MCP plugins, please refer to **[Plugin Registry > Custom MCP Plugin](/plugins/#in-depth-tutorial-building-a-custom-mcp-plugin)**.

---

## 🛠️ Managing External MCP Servers (Nyxora as an MCP Client)

In addition to acting as an MCP Server for external IDEs, Nyxora also operates as an **MCP Client** that can dynamically connect to and consume third-party MCP servers (such as `sequential-thinking` or `memory`).

To learn how to add, remove, and synchronize external MCP servers via the Dashboard/Desktop GUI or the `~/.nyxora/config/nyxmcp.yaml` configuration file, please consult **[Managing External MCP Servers](/mcp/external-servers)**.
