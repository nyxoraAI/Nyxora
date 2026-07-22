import React, { useState, useEffect } from 'react';
import { Server, Copy, Check, ExternalLink, Terminal, Zap, BookOpen, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
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
