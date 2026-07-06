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

## 🔌 Membangun MCP Plugin Kustom

Nyxora juga memungkinkan Anda untuk menyuntikkan (inject) kemampuan baru ke dalam MCP Server dengan membuat plugin secara mandiri. Hal ini sangat berguna jika Anda ingin menghubungkan API internal perusahaan atau *smart contract* privat Anda agar dapat diakses oleh AI.

Untuk panduan mendalam (*step-by-step*) beserta *code snippet* tentang cara membuat MCP Plugin kustom, silakan merujuk ke halaman **[Plugin Registry > Custom MCP Plugin](/plugins/#tutorial-mendalam-membuat-custom-mcp-plugin)**.
