# ⚙️ Managing External MCP Servers

In addition to serving as an MCP Server for external clients, Nyxora acts as an **MCP Client** that can dynamically connect to and consume external Model Context Protocol (MCP) servers.

You can equip your Nyxora AI Agent with specialized external tools (such as `@modelcontextprotocol/server-sequential-thinking`, `@modelcontextprotocol/server-memory`, filesystem tools, or custom internal servers) and manage them in real-time.

---

## 🖥️ Managing MCP Servers via UI

You can view, add, and remove external MCP servers directly from the Graphical User Interface without touching configuration files or restarting the daemon:

1. **In Dashboard or Desktop App:**
   - Navigate to **Settings ➔ Advanced ➔ MCP Servers & Tools**.
2. **Adding a New Server:**
   - Enter the **Server Name** (e.g., `sequential-thinking`).
   - Specify the **Command** (e.g., `npx`).
   - Provide **Arguments** (e.g., `-y @modelcontextprotocol/server-sequential-thinking`).
   - Optionally define environment variables (`KEY=VALUE`).
   - Click **Add MCP Server**.
3. **Deleting a Server:**
   - Click the trash icon next to any active server to remove it from your active configuration.

---

## 📁 Configuration File (`nyxmcp.yaml`)

All external MCP servers are persisted locally in your Nyxora configuration directory:

```
~/.nyxora/config/nyxmcp.yaml
```

### Example `nyxmcp.yaml` Structure:
```yaml
mcp_servers:
  sequential-thinking:
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-sequential-thinking"
  long-term-memory:
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-memory"
```

---

## 🔌 Dedicated REST API Endpoints

The Nyxora Core Gateway provides dedicated HTTP endpoints to query and manage your MCP servers programmatically:

*   `GET /api/mcp-servers` — Returns the current dictionary of active external MCP servers.
*   `POST /api/mcp-servers` — Registers a new MCP server and saves it to `nyxmcp.yaml`.
*   `DELETE /api/mcp-servers/:name` — Removes the specified MCP server from the configuration.

### Triple-Fallback Synchronization
To ensure zero-latency UI synchronization even during network turbulence, both Dashboard (`Mcp.tsx`) and Desktop (`McpSettings.svelte`) clients use a resilient triple-fallback loader:
1. Queries `/api/mcp-servers` directly.
2. If unreachable or empty, falls back to `/api/config` (which merges `nyxmcp.yaml`).
3. If offline, loads from cached in-memory store (`configStore`).
