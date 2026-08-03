import React, { useState, useEffect } from 'react';
import { Server, Copy, Check, ExternalLink, Terminal, Zap, BookOpen, RefreshCw, CheckCircle, XCircle, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from './utils/api';

const codeBlock = (code: string) => (
  <code style={{
    display: 'block', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)',
    borderRadius: '6px', padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.82rem',
    color: 'var(--accent)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all'
  }}>{code}</code>
);

const CopyBlock: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: 'relative' }}>
      {codeBlock(code)}
      <button
        onClick={copy}
        style={{ position: 'absolute', top: '8px', right: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
      >
        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
      </button>
    </div>
  );
};

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0, marginTop: '2px' }}>{n}</div>
    <div style={{ flex: 1 }}>
      <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{title}</h4>
      {children}
    </div>
  </div>
);

const Mcp: React.FC = () => {
  const [mcpStatus, setMcpStatus] = useState<'checking' | 'running' | 'stopped'>('checking');
  const [port] = useState(3001);
  const host = `http://localhost:${port}`;

  const [mcpServers, setMcpServers] = useState<Record<string, any>>({});
  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('npx');
  const [newArgs, setNewArgs] = useState('');
  const [newEnv, setNewEnv] = useState('');
  const [loadingServers, setLoadingServers] = useState(false);
  const [serverMsg, setServerMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchMcpServers = async () => {
    setLoadingServers(true);
    try {
      const res = await apiFetch('/api/mcp-servers');
      if (res.ok) {
        const data = await res.json();
        if (data.mcp_servers && Object.keys(data.mcp_servers).length > 0) {
          setMcpServers(data.mcp_servers);
          return;
        }
      }
      // Fallback: /api/config merges nyxmcp.yaml into .mcp_servers
      const configRes = await apiFetch('/api/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.mcp_servers) {
          setMcpServers(configData.mcp_servers);
        }
      }
    } catch {
    } finally {
      setLoadingServers(false);
    }
  };

  useEffect(() => {
    fetchMcpServers();
  }, []);

  const handleAddServer = async () => {
    if (!newName.trim() || !newCommand.trim()) {
      setServerMsg({ text: 'Server name and command are required.', type: 'error' });
      return;
    }
    try {
      const argsArray = newArgs.trim().split(/\s+/).filter(Boolean);
      const envObj: Record<string, string> = {};
      newEnv.split('\n').forEach(line => {
        const idx = line.indexOf('=');
        if (idx > 0) {
          envObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
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
        setMcpServers(data.mcp_servers || {});
        setServerMsg({ text: `Added "${newName.trim()}" to ~/.nyxora/config/nyxmcp.yaml!`, type: 'success' });
        setNewName('');
        setNewCommand('npx');
        setNewArgs('');
        setNewEnv('');
      } else {
        setServerMsg({ text: 'Failed to add MCP server.', type: 'error' });
      }
    } catch {
      setServerMsg({ text: 'Error connecting to server.', type: 'error' });
    }
  };

  const handleDeleteServer = async (name: string) => {
    try {
      const res = await apiFetch(`/api/mcp-servers/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setMcpServers(data.mcp_servers || {});
        setServerMsg({ text: `Deleted "${name}" from ~/.nyxora/config/nyxmcp.yaml.`, type: 'success' });
      }
    } catch {
      setServerMsg({ text: 'Failed to delete server.', type: 'error' });
    }
  };

  useEffect(() => {
    const check = async () => {
      try {
        const res = await apiFetch('/api/status');
        setMcpStatus(res.ok ? 'running' : 'stopped');
      } catch {
        setMcpStatus('running'); // backend is running if we got here
      }
    };
    check();
  }, []);

  const claudeConfig = JSON.stringify({
    mcpServers: {
      nyxora: {
        command: "npx",
        args: ["nyxora-mcp-server"],
        env: {
          NYXORA_TOKEN: "<your-token-from-~/.nyxora/auth/runtime.token>"
        }
      }
    }
  }, null, 2);

  const cursorConfig = JSON.stringify({
    mcpServers: {
      nyxora: {
        command: "npx",
        args: ["nyxora-mcp-server"]
      }
    }
  }, null, 2);

  return (
    <div className="overview-container" style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px', padding: '10px' }}>
          <Server size={24} color="#8b5cf6" />
        </div>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>Model Context Protocol (MCP)</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Connect Claude Desktop, Cursor, or any MCP client to Nyxora's capabilities</p>
        </div>
      </div>

      {/* What is MCP */}
      <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Zap size={16} color="#8b5cf6" />
          <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>What is MCP?</strong>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.7 }}>
          MCP (Model Context Protocol) lets any compatible AI client — like <strong style={{ color: 'var(--text-primary)' }}>Claude Desktop</strong> or <strong style={{ color: 'var(--text-primary)' }}>Cursor</strong> — use Nyxora's Web3 tools directly. This means you can swap tokens, check your portfolio, or execute DeFi operations from within Claude or your IDE.
        </p>
      </div>

      {/* MCP Server Status */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', marginBottom: '24px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
          <Server size={18} color="#8b5cf6" />
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>MCP Server Status</h3>
        </div>
        <div style={{ padding: '20px', display: 'flex', gap: '32px' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>TRANSPORT</div>
            <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.9rem' }}>stdio (subprocess)</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>PACKAGE</div>
            <div style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: '0.9rem' }}>nyxora-mcp-server</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>AUTH</div>
            <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.9rem' }}>~/.nyxora/auth/runtime.token</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>BACKEND</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {mcpStatus === 'checking' && <RefreshCw size={14} color="#f59e0b" className="spinner" />}
              {mcpStatus === 'running' && <CheckCircle size={14} color="#10b981" />}
              {mcpStatus === 'stopped' && <XCircle size={14} color="#ef4444" />}
              <span style={{ color: mcpStatus === 'running' ? '#10b981' : mcpStatus === 'stopped' ? '#ef4444' : '#f59e0b', fontSize: '0.9rem', fontWeight: 600 }}>
                {mcpStatus === 'checking' ? 'Checking...' : mcpStatus === 'running' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Setup guides */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', marginBottom: '24px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)' }}>
          {['Claude Desktop', 'Cursor / VS Code', 'Manual (npx)'].map((tab, i) => (
            <div key={tab} id={`mcp-tab-${i}`} style={{ padding: '12px 20px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)', borderRight: '1px solid var(--glass-border)' }}>
              {tab}
            </div>
          ))}
        </div>

        <div style={{ padding: '24px' }}>
          {/* Claude Desktop */}
          <div>
            <Step n={1} title="Get your runtime token">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 8px 0' }}>Your auth token is generated when the backend starts:</p>
              <CopyBlock code="cat ~/.nyxora/auth/runtime.token" />
            </Step>

            <Step n={2} title="Open Claude Desktop config">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 8px 0' }}>
                Mac: <code style={{ color: 'var(--accent)' }}>~/Library/Application Support/Claude/claude_desktop_config.json</code><br />
                Linux: <code style={{ color: 'var(--accent)' }}>~/.config/Claude/claude_desktop_config.json</code>
              </p>
            </Step>

            <Step n={3} title="Add Nyxora MCP server">
              <CopyBlock code={claudeConfig} />
            </Step>

            <Step n={4} title="Restart Claude Desktop">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Fully quit and reopen Claude. You'll see a 🔌 MCP icon — Nyxora tools are now available.
              </p>
            </Step>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '16px 0 24px' }} />

          {/* Cursor */}
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Cursor / VS Code:</strong> Open Settings → MCP → Add Server, or add to <code style={{ color: 'var(--accent)' }}>.cursor/mcp.json</code>:
            </p>
            <CopyBlock code={cursorConfig} />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '16px 0 24px' }} />

          {/* Manual */}
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Run manually from terminal:</strong>
            </p>
            <CopyBlock code={`NYXORA_TOKEN=$(cat ~/.nyxora/auth/runtime.token) npx nyxora-mcp-server`} />
          </div>
        </div>
      </div>

      {/* External MCP Servers Manager (~/.nyxora/config/nyxmcp.yaml) */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', marginBottom: '24px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Server size={18} color="#8b5cf6" />
            <div>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>External MCP Servers & Tools</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Synchronized with <code style={{ color: 'var(--accent)' }}>~/.nyxora/config/nyxmcp.yaml</code></div>
            </div>
          </div>
          <button onClick={fetchMcpServers} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
            <RefreshCw size={13} className={loadingServers ? 'spinner' : ''} /> Refresh
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {serverMsg && (
            <div style={{ padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem', background: serverMsg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: serverMsg.type === 'success' ? '#10b981' : '#ef4444', border: `1px solid ${serverMsg.type === 'success' ? '#10b981' : '#ef4444'}` }}>
              {serverMsg.text}
            </div>
          )}

          {/* List of configured MCP servers */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em', marginBottom: '10px', textTransform: 'uppercase' }}>
              CONFIGURED SERVERS ({Object.keys(mcpServers).length})
            </div>
            {Object.keys(mcpServers).length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', background: 'var(--bg-primary)', borderRadius: '6px' }}>
                No external MCP servers configured in nyxmcp.yaml.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(mcpServers).map(([name, cfg]: [string, any]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.disabled ? '#9ca3af' : '#10b981' }}></span>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{name}</strong>
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {cfg.command} {(cfg.args || []).join(' ')}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteServer(name)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add MCP Server form */}
          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
              <Plus size={16} color="#8b5cf6" /> Add External MCP Server
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>SERVER NAME</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. github-server" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>COMMAND</label>
                <input type="text" value={newCommand} onChange={e => setNewCommand(e.target.value)} placeholder="e.g. npx" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', color: '#3b82f6', fontFamily: 'monospace', fontSize: '0.85rem' }} />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>ARGUMENTS (SPACE SEPARATED)</label>
              <input type="text" value={newArgs} onChange={e => setNewArgs(e.target.value)} placeholder="e.g. -y @modelcontextprotocol/server-github" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>ENVIRONMENT VARIABLES (KEY=VALUE PER LINE)</label>
              <textarea value={newEnv} onChange={e => setNewEnv(e.target.value)} rows={2} placeholder="GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleAddServer} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={14} /> Save to nyxmcp.yaml
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Available tools */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
          <Terminal size={18} color="#8b5cf6" />
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>Tools Exposed via MCP</h3>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {[
            'chat — Talk to Nyxora agent',
            'get_portfolio — View wallet balances',
            'transfer_token — Send tokens',
            'swap_token — DEX swap',
            'bridge_token — Cross-chain bridge',
            'get_price — Token price lookup',
            'check_gas — Gas price on any chain',
            'schedule_task — Create cron job',
            'get_memory — Read agent memory',
          ].map(tool => (
            <div key={tool} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', background: 'var(--bg-primary)', borderRadius: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--accent)', marginTop: '1px', flexShrink: 0 }}>▸</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{tool.split(' — ')[0]}</strong>
                {' — '}{tool.split(' — ')[1]}
              </span>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={14} color="var(--text-secondary)" />
          <a href="https://modelcontextprotocol.io/docs" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
            Learn more about MCP <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default Mcp;
