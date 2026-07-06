# ⚙️ Cursor IDE Configuration

If you are using the Cursor IDE and want its AI features to interact with Nyxora:

1. Open Cursor Settings.
2. Navigate to **Features** > **MCP Servers**.
3. Click **Add New MCP Server**.
4. Set the Type to `command`.
5. Set the Name to `nyxora`.
6. Set the Command to:
   - **Global Install:** `nyxora mcp`
   - **Source Code Install:** `node /absolute/path/to/Nyxora/packages/mcp-server/dist/server.js`
7. Click Save and Refresh.
