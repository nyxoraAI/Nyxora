<script lang="ts">
  import { onMount } from 'svelte';
  import { Server, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Terminal, ExternalLink, RefreshCw } from '@lucide/svelte';
  import { apiFetch } from '$lib/utils/api';
  import { configStore } from '$lib/stores/config.svelte';

  interface McpServerConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    disabled?: boolean;
  }

  let mcpServers = $state<Record<string, McpServerConfig>>({});
  let loading = $state(true);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);

  // Form state for adding new MCP server
  let newName = $state('');
  let newCommand = $state('npx');
  let newArgs = $state('');
  let newEnv = $state('');
  let isSubmitting = $state(false);
  let deletingName = $state<string | null>(null);

  async function fetchMcpServers() {
    try {
      // First check dedicated API endpoint
      const res = await apiFetch('/api/mcp-servers');
      if (res.ok) {
        const data = await res.json();
        if (data.mcp_servers && Object.keys(data.mcp_servers).length > 0) {
          mcpServers = data.mcp_servers;
          return;
        }
      }

      // Fallback: /api/config automatically loads and merges ~/.nyxora/config/nyxmcp.yaml
      const configRes = await apiFetch('/api/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.mcp_servers && Object.keys(configData.mcp_servers).length > 0) {
          mcpServers = configData.mcp_servers;
          return;
        }
      }

      // Fallback: use configStore cached servers
      if (configStore?.config?.mcp_servers && Object.keys(configStore.config.mcp_servers).length > 0) {
        mcpServers = configStore.config.mcp_servers;
      }
    } catch (err) {
      console.error('Failed to fetch MCP servers:', err);
      if (configStore?.config?.mcp_servers) {
        mcpServers = configStore.config.mcp_servers;
      }
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchMcpServers();
    const interval = setInterval(fetchMcpServers, 10000);
    return () => clearInterval(interval);
  });

  async function handleAddServer() {
    if (!newName.trim() || !newCommand.trim()) {
      errorMsg = 'Server name and command are required.';
      return;
    }
    isSubmitting = true;
    errorMsg = null;
    successMsg = null;

    try {
      const argsArray = newArgs
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      const envObj: Record<string, string> = {};
      newEnv.split('\n').forEach(line => {
        const idx = line.indexOf('=');
        if (idx > 0) {
          const key = line.slice(0, idx).trim();
          const val = line.slice(idx + 1).trim();
          if (key) envObj[key] = val;
        }
      });

      const res = await apiFetch('/api/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          command: newCommand.trim(),
          args: argsArray,
          env: envObj,
          disabled: false
        })
      });

      if (res.ok) {
        const data = await res.json();
        mcpServers = data.mcp_servers || {};
        successMsg = `Added MCP server "${newName.trim()}" to nyxmcp.yaml!`;
        newName = '';
        newCommand = 'npx';
        newArgs = '';
        newEnv = '';
        setTimeout(() => { successMsg = null; }, 4000);
      } else {
        const err = await res.json();
        errorMsg = err.error || 'Failed to add MCP server.';
      }
    } catch (err: any) {
      errorMsg = err.message || 'Connection error.';
    } finally {
      isSubmitting = false;
    }
  }

  async function handleDeleteServer(name: string) {
    deletingName = name;
    errorMsg = null;
    successMsg = null;

    try {
      const res = await apiFetch(`/api/mcp-servers/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        mcpServers = data.mcp_servers || {};
        successMsg = `Removed MCP server "${name}" from nyxmcp.yaml.`;
        setTimeout(() => { successMsg = null; }, 4000);
      } else {
        errorMsg = `Failed to delete server "${name}".`;
      }
    } catch (err: any) {
      errorMsg = err.message || 'Connection error.';
    } finally {
      deletingName = null;
    }
  }
</script>

<div class="h-full w-full overflow-y-auto bg-gray-50 dark:bg-[#18181b] text-gray-900 dark:text-[#ffffff] p-8">
  <div class="max-w-[850px] mx-auto space-y-8 pb-16">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <div class="p-3 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30 rounded-2xl">
        <Server size={28} class="text-blue-500 dark:text-blue-400" />
      </div>
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">MCP Servers & Tools</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
          <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          Synchronized in real-time with <code class="text-blue-500 dark:text-blue-400 font-mono">~/.nyxora/config/nyxmcp.yaml</code>
        </p>
      </div>
    </div>

    <!-- Status Banner -->
    {#if successMsg}
      <div class="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 size={16} class="shrink-0" />
        <span class="text-xs font-medium">{successMsg}</span>
      </div>
    {/if}
    {#if errorMsg}
      <div class="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
        <AlertCircle size={16} class="shrink-0" />
        <span class="text-xs font-medium">{errorMsg}</span>
      </div>
    {/if}

    <!-- Active MCP Servers List -->
    <div>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
          CONFIGURED MCP SERVERS ({Object.keys(mcpServers).length})
        </h3>
        <button
          onclick={fetchMcpServers}
          class="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-500 transition-colors"
          title="Refresh servers"
        >
          <RefreshCw size={13} class={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {#if loading}
        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 p-6">
          <Loader2 size={18} class="animate-spin" /> Loading from nyxmcp.yaml...
        </div>
      {:else if Object.keys(mcpServers).length === 0}
        <div class="bg-white dark:bg-[#222226] border border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-8 text-center">
          <Server size={36} class="mx-auto mb-3 text-gray-400 dark:text-gray-500 opacity-40" />
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">No MCP servers configured yet.</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 opacity-80">Add a server below to expand Nyxora's tool capabilities.</p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each Object.entries(mcpServers) as [name, config]}
            <div class="flex items-center justify-between bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 hover:border-blue-500/50 rounded-xl px-5 py-4 transition-all shadow-sm">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-2.5 h-2.5 rounded-full {config.disabled ? 'bg-gray-400' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'} shrink-0"></div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-sm text-gray-900 dark:text-gray-100">{name}</span>
                    {#if config.env && Object.keys(config.env).length > 0}
                      <span class="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-500 font-mono">
                        {Object.keys(config.env).length} ENV
                      </span>
                    {/if}
                  </div>
                  <div class="text-xs font-mono text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {config.command} {(config.args || []).join(' ')}
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <button
                  onclick={() => handleDeleteServer(name)}
                  disabled={deletingName === name}
                  class="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Remove MCP Server"
                >
                  {#if deletingName === name}
                    <Loader2 size={15} class="animate-spin" />
                  {:else}
                    <Trash2 size={15} />
                  {/if}
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Add New MCP Server Form -->
    <div class="bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl p-6 shadow-sm">
      <div class="flex items-center gap-2 mb-4">
        <Plus size={18} class="text-blue-500" />
        <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">Add External MCP Server</h3>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-5">
        Configure any stdio Model Context Protocol server (e.g. GitHub, Filesystem, Postgres, Brave Search).
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            SERVER NAME
          </label>
          <input
            type="text"
            bind:value={newName}
            placeholder="e.g. github-server"
            class="w-full bg-gray-50 dark:bg-[#18181b] border border-gray-200/80 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            COMMAND
          </label>
          <input
            type="text"
            bind:value={newCommand}
            placeholder="e.g. npx"
            class="w-full bg-gray-50 dark:bg-[#18181b] border border-gray-200/80 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm font-mono text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
      </div>

      <div class="mb-4">
        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
          ARGUMENTS (SPACE-SEPARATED)
        </label>
        <input
          type="text"
          bind:value={newArgs}
          placeholder="e.g. -y @modelcontextprotocol/server-github"
          class="w-full bg-gray-50 dark:bg-[#18181b] border border-gray-200/80 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm font-mono text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      <div class="mb-5">
        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
          ENVIRONMENT VARIABLES (ONE PER LINE, KEY=VALUE)
        </label>
        <textarea
          bind:value={newEnv}
          rows="2"
          placeholder="GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx"
          class="w-full bg-gray-50 dark:bg-[#18181b] border border-gray-200/80 dark:border-white/10 rounded-xl p-3 text-sm font-mono text-gray-800 dark:text-gray-200 resize-none outline-none focus:ring-2 focus:ring-blue-500/40"
        ></textarea>
      </div>

      <div class="flex justify-end">
        <button
          onclick={handleAddServer}
          disabled={isSubmitting || !newName.trim() || !newCommand.trim()}
          class="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
        >
          {#if isSubmitting}
            <Loader2 size={15} class="animate-spin" />
          {:else}
            <Plus size={15} />
          {/if}
          Save to nyxmcp.yaml
        </button>
      </div>
    </div>

    <!-- Built-in MCP Tools Information -->
    <div class="bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl p-6 shadow-sm">
      <div class="flex items-center gap-2 mb-3">
        <Terminal size={18} class="text-purple-500" />
        <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">Nyxora Built-in Tools Exposed via MCP</h3>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
        These tools are automatically available to any connected MCP client (Claude Desktop, Cursor, IDEs) using <code class="text-blue-500 font-mono">nyxora-mcp-server</code>:
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {#each [
          ['chat', 'Talk to Nyxora agent'],
          ['get_portfolio', 'View wallet balances'],
          ['transfer_token', 'Send tokens'],
          ['swap_token', 'DEX swap tokens'],
          ['bridge_token', 'Cross-chain bridge'],
          ['get_price', 'Token price lookup'],
          ['check_gas', 'Gas price on any chain'],
          ['schedule_task', 'Create cron job'],
          ['get_memory', 'Read agent memory']
        ] as [tool, desc]}
          <div class="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-[#18181b] border border-gray-200/50 dark:border-white/5 text-xs">
            <span class="text-blue-500 font-bold">▸</span>
            <div>
              <span class="font-mono font-bold text-gray-900 dark:text-gray-100">{tool}</span>
              <span class="text-gray-500 dark:text-gray-400 block text-[11px] mt-0.5">{desc}</span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
