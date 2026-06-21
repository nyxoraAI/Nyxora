import { apiFetch } from './utils/api';
import React, { useState, useEffect, useRef } from 'react';
import './overview.css';

interface Config {
  agent: { name: string; default_chain: string };
  llm: { provider: string; model: string; temperature: number };
}

interface Stats {
  cost: number;
  tokens: number;
  messages: number;
  memoryPath?: string;
  totalSkills?: number;
  activeSkills?: number;
}

interface EventLog {
  timestamp: string;
  event: string;
  meta: any;
}

interface GatewayLog {
  timestamp: string;
  message: string;
  meta?: any;
}

interface EpisodicMemory {
  id: number;
  fact: string;
  occurrences: number;
  confidence: number;
  category: string;
  rule_type: string;
  lastSeen: string;
}

interface OverviewProps {
  config: Config | null;
  sessionsCount: number;
}

const Overview: React.FC<OverviewProps> = ({ config, sessionsCount }) => {
  const [stats, setStats] = useState<Stats>({ cost: 0, tokens: 0, messages: 0 });
  const [events, setEvents] = useState<EventLog[]>([]);
  const [gatewayLogs, setGatewayLogs] = useState<GatewayLog[]>([]);
  const [memories, setMemories] = useState<EpisodicMemory[]>([]);
  const [cronJobs, setCronJobs] = useState<number>(0);
  const eventLogsEndRef = useRef<HTMLDivElement>(null);
  const gatewayLogsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await apiFetch('/api/stats');
        if (statsRes.ok) setStats(await statsRes.json());

        const logsRes = await apiFetch('/api/logs');
        if (logsRes.ok) {
          const logs = await logsRes.json();
          setEvents(logs.events);
          setGatewayLogs(logs.gateway);
        }

        const cronRes = await apiFetch('/api/cron');
        if (cronRes.ok) {
          const cronData = await cronRes.json();
          setCronJobs(cronData.activeJobs);
        }

        const memRes = await apiFetch('/api/memory');
        if (memRes.ok) {
          setMemories(await memRes.json());
        }
      } catch (err) {
        console.error("Failed to fetch analytics");
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteMemory = async (id: number) => {
    try {
      await apiFetch(`/api/memory/${id}`, { method: 'DELETE' });
      setMemories(memories.filter(m => m.id !== id));
    } catch (err) {
      console.error('Failed to delete memory');
    }
  };

  if (!config) return <div className="overview-container">Loading...</div>;

  return (
    <div className="overview-container">
      <div className="overview-header">
        <h1>Nyxora Status</h1>
        <p>System health, active configuration, and loaded Web3 skills.</p>
      </div>

      <div className="panel gateway-access">
        <div className="panel-header">
          <h3>System Configuration</h3>
          <p>Current runtime parameters for your Web3 Agent.</p>
        </div>
        
        <div className="form-row">
          <div className="form-group flex-1">
            <label>API Endpoint</label>
            <input type="text" value="/api/chat" readOnly />
          </div>
          <div className="form-group flex-1">
            <label>Agent Name</label>
            <input type="text" value={config.agent.name} readOnly />
          </div>
          <div className="form-group flex-1">
            <label>Memory Storage</label>
            <input type="text" value={stats.memoryPath || "./memory.json"} readOnly />
          </div>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <label>COST</label>
          <div className="metric-val">${stats.cost.toFixed(4)}</div>
          <div className="metric-sub">{stats.tokens} tokens - {stats.messages} msgs</div>
        </div>
        <div className="metric-card">
          <label>SESSIONS</label>
          <div className="metric-val">{sessionsCount}</div>
          <div className="metric-sub">{sessionsCount} Local chat session{sessionsCount !== 1 ? 's' : ''} active</div>
        </div>
        <div className="metric-card">
          <label>SKILLS</label>
          <div className="metric-val">{stats.activeSkills !== undefined ? stats.activeSkills : 2}/{stats.totalSkills !== undefined ? stats.totalSkills : 2}</div>
          <div className="metric-sub">{stats.totalSkills !== undefined ? stats.totalSkills : 2} Web3 & OS skills loaded</div>
        </div>
        <div className="metric-card">
          <label>CRON</label>
          <div className="metric-val">{cronJobs} jobs</div>
          <div className="metric-sub">{cronJobs === 0 ? 'No scheduled tasks' : `${cronJobs} active schedule(s)`}</div>
        </div>
        <div className="metric-card">
          <label>MODEL AUTH</label>
          <div className="metric-val text-green">1 ok</div>
          <div className="metric-sub">{config.llm.provider.toUpperCase()} provider connected</div>
        </div>
      </div>

      <div className="logs-grid">
        <div className="log-panel">
          <div className="log-header">
            <span>Event Log <span className="badge">{events.length}</span></span>
          </div>
          <div className="log-content">
            {events.map((log, i) => (
              <div key={i} className="log-row" style={{ fontFamily: 'monospace' }}>
                <span className="log-time" style={{ color: 'var(--accent)' }}>[{log.timestamp}]</span>
                <span className="log-msg" style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                  {log.event} {log.meta && Object.keys(log.meta).length > 0 ? <span className="log-meta" style={{ color: 'var(--text-secondary)' }}>{JSON.stringify(log.meta)}</span> : null}
                </span>
              </div>
            ))}
            <div ref={eventLogsEndRef} />
          </div>
        </div>
        <div className="log-panel">
          <div className="log-header">
            <span>Gateway Logs <span className="badge">{gatewayLogs.length}</span></span>
          </div>
          <div className="log-content">
            {gatewayLogs.map((log, i) => {
              let cleanMessage = log.message.replace(/\x1b\[[0-9;]*m/g, '');
              cleanMessage = cleanMessage.replace(/token=[a-fA-F0-9]+/g, 'token=••••••••[REDACTED]••••••••');
              return (
                <div key={i} className="log-row gateway-row" style={{ fontFamily: 'monospace' }}>
                  <span className="log-time" style={{ color: 'var(--accent)' }}>[{log.timestamp}]</span>
                  <span className="log-msg" style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                    {cleanMessage} {log.meta ? JSON.stringify(log.meta) : ''}
                  </span>
                </div>
              );
            })}
            <div ref={gatewayLogsEndRef} />
          </div>
        </div>
      </div>

      <div className="panel gateway-access" style={{ marginTop: '24px' }}>
        <div className="panel-header">
          <h3>Memory Log</h3>
          <p>AI's episodic memory and extracted habits. You can delete incorrect observations.</p>
        </div>
        <div className="form-row memory-log-container" style={{ flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
          {memories.length === 0 ? (
            <div style={{ color: 'var(--accent)', fontStyle: 'italic', padding: '10px' }}>No episodic memories recorded yet. Start chatting to teach the AI your habits!</div>
          ) : (
            memories.map(mem => (
              <div key={mem.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-sidebar)', padding: '10px 15px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{mem.fact}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                    Category: {mem.category} | Type: {mem.rule_type} | Confidence: {(mem.confidence * 100).toFixed(0)}% | Occurrences: {mem.occurrences}
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteMemory(mem.id)}
                  style={{ background: 'var(--danger)', color: '#eceff4', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Overview;
