# ⚙️ Claude Desktop Configuration

To connect Claude Desktop to Nyxora, you need to add Nyxora as an MCP Server in your Claude configuration file.

1. Open your Claude Desktop configuration file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the following JSON snippet to the `mcpServers` object.

**If you installed Nyxora globally (Option 1 & 2):**
```json
{
  "mcpServers": {
    "nyxora": {
      "command": "nyxora",
      "args": ["mcp"]
    }
  }
}
```

**If you run Nyxora from source code (Option 3):**
```json
{
  "mcpServers": {
    "nyxora": {
      "command": "node",
      "args": ["/absolute/path/to/Nyxora/packages/mcp-server/dist/server.js"]
    }
  }
}
```

3. **Restart Claude Desktop**. You will now see a new "plug" icon or Nyxora tools available in your Claude chat!

> ** NVM & PATH Troubleshooting (Important for Claude Desktop):**
> Claude Desktop is a GUI application and **does not automatically inherit your terminal's `PATH` variables**. If you installed Node.js via NVM or Volta, Claude may fail to find the `nyxora` or `node` command.
>
> If you encounter connection errors, you must replace `"nyxora"` with the absolute path to the binary. To find the correct path, run `which nyxora` (or `which node`) in your terminal. For example: `"command": "/Users/username/.nvm/versions/node/v20.0.0/bin/nyxora"`.
>
> **To view Claude Logs:** macOS (`~/Library/Logs/Claude/mcp.log`), Windows (`%APPDATA%\Claude\logs\mcp.log`).
