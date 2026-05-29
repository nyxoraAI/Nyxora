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

interface OverviewProps {
  config: Config | null;
}

const Overview: React.FC<OverviewProps> = ({ config }) => {
  const [stats, setStats] = useState<Stats>({ cost: 0, tokens: 0, messages: 0 });
  const [events, setEvents] = useState<EventLog[]>([]);
  const [gatewayLogs, setGatewayLogs] = useState<GatewayLog[]>([]);
  const eventLogsEndRef = useRef<HTMLDivElement>(null);
  const gatewayLogsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await apiFetch('http://localhost:3000/api/stats');
        if (statsRes.ok) setStats(await statsRes.json());

        const logsRes = await apiFetch('http://localhost:3000/api/logs');
        if (logsRes.ok) {
          const logs = await logsRes.json();
          setEvents(logs.events);
          setGatewayLogs(logs.gateway);
        }
      } catch (err) {
        console.error("Failed to fetch analytics");
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

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
            <input type="text" value="http://localhost:3000/api/chat" readOnly />
          </div>
          <div className="form-group flex-1">
            <label>Agent Name</label>
            <input type="text" value={config.agent.name} readOnly />
          </div>
          <div className="form-group flex-1">
            <label>Memory Storage</label>
            <input type="text" value="./memory.json" readOnly />
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
          <div className="metric-val">1</div>
          <div className="metric-sub">Local chat session active</div>
        </div>
        <div className="metric-card">
          <label>SKILLS</label>
          <div className="metric-val">2/2</div>
          <div className="metric-sub">2 Web3 skills loaded</div>
        </div>
        <div className="metric-card">
          <label>CRON</label>
          <div className="metric-val">0 jobs</div>
          <div className="metric-sub">No scheduled tasks</div>
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
              <div key={i} className="log-row">
                <span className="log-time">{log.timestamp}</span>
                <span className="log-msg">
                  {log.event} <span className="log-meta">{JSON.stringify(log.meta)}</span>
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
            {gatewayLogs.map((log, i) => (
              <div key={i} className="log-row gateway-row">
                <span className="log-json">
                  {`{"timestamp":"${log.timestamp}","message":${JSON.stringify(log.message)}${log.meta ? `,"meta":${JSON.stringify(log.meta)}` : ''}}`}
                </span>
              </div>
            ))}
            <div ref={gatewayLogsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
