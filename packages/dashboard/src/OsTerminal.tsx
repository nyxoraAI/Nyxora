import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, ShieldAlert, Cpu, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';
import { apiFetch } from './utils/api';
import { usePolling } from './utils/usePolling';

export const OsTerminal: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isKilling, setIsKilling] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await apiFetch('/api/terminal/logs');
      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          setLogs(prev => {
            // Only update if logs are different to avoid unnecessary re-renders
            if (prev.length === data.logs.length && prev[prev.length - 1] === data.logs[data.logs.length - 1]) {
              return prev;
            }
            return data.logs;
          });
        }
      }
    } catch (e) {
      // ignore network errors silently
    }
  };

  usePolling(fetchLogs, 2000);

  const handleScroll = () => {
    if (!terminalContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isNearBottom);
  };

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleKill = async () => {
    if (!window.confirm("Are you sure you want to kill the active OS Agent process? This will stop any ongoing shell commands.")) {
      return;
    }
    
    setIsKilling(true);
    try {
      await apiFetch('/api/terminal/kill', { method: 'POST' });
      await fetchLogs();
    } catch (e) {
      alert("Failed to send kill signal.");
    } finally {
      setIsKilling(false);
    }
  };

  return (
    <div className="overview-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '10px' }}>
            <TerminalIcon size={24} color="#ef4444" />
          </div>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>OS Terminal Sandbox</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Live monitoring of local machine commands executed by the AI Agent.
            </p>
          </div>
        </div>
        
        {/* Kill Switch */}
        <button 
          onClick={handleKill}
          disabled={isKilling}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            background: 'var(--danger)', color: '#fff', 
            border: 'none', padding: '10px 20px', borderRadius: '8px', 
            cursor: isKilling ? 'not-allowed' : 'pointer', fontWeight: 700,
            opacity: isKilling ? 0.7 : 1, boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)'
          }}
        >
          <ShieldAlert size={18} />
          {isKilling ? 'TERMINATING...' : 'KILL PROCESS'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: isMinimized ? 'auto' : '500px' }}>
        {/* Terminal Window */}
        <div style={{ 
          ...(isFullscreen ? {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, borderRadius: 0
          } : {
            flex: 1, borderRadius: '12px', minHeight: isMinimized ? 'auto' : '500px', height: isMinimized ? 'fit-content' : 'auto'
          }),
          background: '#09090b', 
          border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
        }}>
          {/* Terminal Header Bar */}
          <div style={{ background: '#18181b', padding: '10px 16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div 
                onClick={handleKill}
                title="Kill Process"
                style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', cursor: 'pointer', opacity: isKilling ? 0.5 : 1 }}
              ></div>
              <div 
                onClick={() => {
                  if (isFullscreen) {
                    setIsFullscreen(false);
                    setIsMinimized(false);
                  } else {
                    setIsMinimized(!isMinimized);
                  }
                }}
                title={isFullscreen ? "Exit Fullscreen" : (isMinimized ? "Restore Window" : "Minimize")}
                style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b', cursor: 'pointer' }}
              ></div>
              <div 
                onClick={() => setIsFullscreen(true)}
                title="Fullscreen"
                style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', cursor: 'pointer' }}
              ></div>
              <div style={{ marginLeft: '12px', color: '#71717a', fontSize: '0.75rem', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={14} />
                nyxora-agent@local: ~
              </div>
            </div>
            
            {/* <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{
                background: 'transparent', border: 'none', color: '#71717a',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '4px', borderRadius: '4px', transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#71717a')}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button> */}
          </div>
          
          {/* Terminal Output */}
          {!isMinimized && (
            <div 
              ref={terminalContainerRef}
              onScroll={handleScroll}
              className="styled-scroll" 
              style={{ flex: 1, padding: '16px', overflowY: 'auto', fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.85rem', color: '#a1a1aa' }}
            >
              {logs.length === 0 ? (
                <div style={{ color: '#52525b', fontStyle: 'italic' }}>No recent OS executions detected. Agent is idle.</div>
              ) : (
                logs.map((log, i) => {
                  const isError = log.includes('error') || log.includes('failed') || log.includes('⚠️');
                  const isCommand = log.includes('$ ');
                  return (
                    <div key={i} style={{ 
                      marginBottom: '4px', 
                      lineHeight: '1.5',
                      color: isError ? '#ef4444' : isCommand ? '#10b981' : '#a1a1aa'
                    }}>
                      {log}
                    </div>
                  );
                })
              )}
              <div ref={terminalEndRef} />
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} color="#f59e0b" />
              Security Warning
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6' }}>
              This terminal provides a raw feed of OS-level commands executed by the agent. If you notice unauthorized behavior, use the <strong>Kill Process</strong> button immediately to terminate the background shell.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OsTerminal;
