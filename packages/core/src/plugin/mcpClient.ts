import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadConfig } from '../config/parser';
import { pluginManager } from './registry';

const activeClients: Map<string, Client> = new Map();
const registeredToolNames = new Set<string>();

export async function initializeMcpServers(): Promise<void> {
  const config = loadConfig();
  const mcpServers = config.mcp_servers || {};

  for (const [serverName, cfg] of Object.entries(mcpServers)) {
    if (!cfg || !cfg.command) continue;
    try {
      console.log(`[MCP] Connecting to server '${serverName}' (${cfg.command} ${(cfg.args || []).join(' ')})...`);
      const transport = new StdioClientTransport({
        command: cfg.command,
        args: cfg.args || [],
        env: { ...process.env, ...(cfg.env || {}) } as any
      });

      const client = new Client({
        name: "nyxora-agent",
        version: "26.8.4"
      }, {
        capabilities: {}
      });

      await client.connect(transport);
      activeClients.set(serverName, client);

      const toolsRes = await client.listTools();
      if (!toolsRes || !toolsRes.tools) continue;

      const tools: any[] = [];
      const handlers: Record<string, (args: any, context?: any) => Promise<any>> = {};

      for (const tool of toolsRes.tools) {
        const cleanServerName = serverName.replace(/[^a-zA-Z0-9_]/g, '_');
        const cleanToolName = tool.name.replace(/[^a-zA-Z0-9_]/g, '_');
        
        // Prefer short name mcp_{toolName} for UI readability, unless there is a collision
        let fullToolName = `mcp_${cleanToolName}`;
        if (registeredToolNames.has(fullToolName)) {
          fullToolName = `mcp_${cleanServerName}_${cleanToolName}`;
        }
        registeredToolNames.add(fullToolName);

        tools.push({
          type: "function",
          function: {
            name: fullToolName,
            description: `[MCP Server: ${serverName}] ${tool.description || tool.name}`,
            parameters: tool.inputSchema || { type: "object", properties: {} }
          }
        });

        handlers[fullToolName] = async (args: any, _context?: any) => {
          try {
            const res = await client.callTool({
              name: tool.name,
              arguments: args || {}
            });
            if (res.content && Array.isArray(res.content)) {
              return res.content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
            }
            return JSON.stringify(res);
          } catch (err: any) {
            return `Error executing MCP tool ${fullToolName}: ${err.message}`;
          }
        };
      }

      pluginManager.register({
        name: `mcp-${serverName}`,
        version: "1.0.0",
        description: `External MCP tools from server '${serverName}'`,
        tools,
        handlers
      });

      console.log(`[MCP] Registered ${tools.length} tools from server '${serverName}'`);
    } catch (err: any) {
      console.error(`[MCP] Failed to connect to server '${serverName}':`, err.message);
    }
  }
}
