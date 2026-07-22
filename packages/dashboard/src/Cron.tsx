import React, { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Play, Zap, TrendingUp, RefreshCw, Bell, Scale, Fuel, Send, ChevronRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from './utils/api';

interface CronJob {
  id: string;
  expression: string;
  prompt: string;
  createdAt: number;
}

interface Template {
  icon: React.ReactNode;
  label: string;
  description: string;
  expression: string;
  prompt: string;
  color: string;
}

const TEMPLATES: Template[] = [
  {
    icon: <TrendingUp size={20} />,
    label: 'Daily Market Report',
    description: 'Analyze top coins and summarize market sentiment every morning.',
    expression: '0 8 * * *',
    prompt: 'Generate a daily market report: analyze BTC, ETH, and top trending tokens. Summarize price movements, key news, and your recommendation for the day.',
    color: '#3b82f6',
  },
  {
    icon: <RefreshCw size={20} />,
    label: 'DCA Schedule',
    description: 'Dollar-cost average into ETH every Monday.',
    expression: '0 9 * * 1',
    prompt: 'Execute a DCA buy: swap $50 worth of USDC to ETH on the default chain using the best available route.',
    color: '#10b981',
  },
  {
    icon: <Bell size={20} />,
    label: 'Price Alert Check',
    description: 'Check BTC price every hour and alert if major move detected.',
    expression: '0 * * * *',
    prompt: 'Check the current BTC price. If it has moved more than 3% in the last hour, send a detailed alert with analysis.',
    color: '#f59e0b',
  },
  {
    icon: <Scale size={20} />,
    label: 'Portfolio Rebalancer',
    description: 'Review and suggest portfolio rebalancing every Sunday.',
    expression: '0 10 * * 0',
    prompt: 'Analyze my current portfolio balance across all chains. Compare against a 60/30/10 ETH/BTC/stables target allocation. Suggest and execute rebalancing trades if deviation exceeds 5%.',
    color: '#8b5cf6',
  },
  {
    icon: <Fuel size={20} />,
    label: 'Gas Watcher',
    description: 'Check gas every 30 mins and execute pending tasks when low.',
    expression: '*/30 * * * *',
    prompt: 'Check current Ethereum mainnet gas price. If base fee is below 15 gwei, report it as a good window for executing pending transactions.',
    color: '#ef4444',
  },
  {
    icon: <Zap size={20} />,
    label: 'Weekly Summary',
    description: 'Full portfolio + market summary every Friday evening.',
    expression: '0 18 * * 5',
    prompt: 'Generate a comprehensive weekly summary: portfolio performance this week, major market events, gains/losses, and strategic recommendations for next week.',
    color: '#06b6d4',
  },
];

const parseCronHuman = (expr: string): string => {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, month, dow] = parts;

  if (expr === '* * * * *') return 'Every minute';
  if (min.startsWith('*/') && hour === '*') return `Every ${min.slice(2)} minutes`;
  if (hour.startsWith('*/') && min === '0') return `Every ${hour.slice(2)} hours`;

  const days: Record<string, string> = { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday' };
  const time = hour !== '*' && min !== '*' ? `at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}` : '';

  if (dom === '*' && month === '*') {
    if (dow !== '*') return `Every ${days[dow] || `day ${dow}`} ${time}`.trim();
    return `Daily ${time}`.trim();
  }
  if (dom !== '*' && dow === '*') return `Monthly on day ${dom} ${time}`.trim();
  return expr;
};

const getNextRun = (expr: string): string => {
  try {
    // Simple approximation for display
    return 'Next scheduled run';
  } catch {
    return '—';
  }
};

const Cron: React.FC = () => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [nlInput, setNlInput] = useState('');
  const [cronExpr, setCronExpr] = useState('0 8 * * *');
  const [promptInput, setPromptInput] = useState('');
  const [mode, setMode] = useState<'natural' | 'manual'>('natural');
  const [isCreating, setIsCreating] = useState(false);
  const [createStatus, setCreateStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      const res = await apiFetch('/api/cron');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (e) {
      console.error('Failed to fetch cron jobs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateFromNL = async () => {
    if (!nlInput.trim()) return;
    setIsCreating(true);
    setCreateStatus(null);

    // Send to chat as a system instruction
    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Schedule a cron job for me: ${nlInput}. Use the schedule_task tool to create this as a recurring job.`,
          session_id: 'cron-setup'
        })
      });

      if (res.ok) {
        setCreateStatus({ type: 'success', msg: 'Instruction sent to agent. The agent will configure the schedule.' });
        setNlInput('');
        setTimeout(fetchJobs, 3000);
      } else {
        setCreateStatus({ type: 'error', msg: 'Failed to send instruction to agent.' });
      }
    } catch (e) {
      setCreateStatus({ type: 'error', msg: 'Connection error.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateManual = async () => {
    if (!cronExpr.trim() || !promptInput.trim()) return;
    setIsCreating(true);
    setCreateStatus(null);

    try {
      const res = await apiFetch('/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: cronExpr.trim(), prompt: promptInput.trim() })
      });

      if (res.ok) {
        setCreateStatus({ type: 'success', msg: 'Cron job created successfully!' });
        setCronExpr('0 8 * * *');
        setPromptInput('');
        fetchJobs();
      } else {
        const err = await res.json();
        setCreateStatus({ type: 'error', msg: err.error || 'Failed to create job.' });
      }
    } catch (e) {
      setCreateStatus({ type: 'error', msg: 'Connection error.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/cron/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setJobs(prev => prev.filter(j => j.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete job', e);
    } finally {
      setDeletingId(null);
    }
  };

  const applyTemplate = (t: Template) => {
    setSelectedTemplate(t.label);
    setMode('manual');
    setCronExpr(t.expression);
    setPromptInput(t.prompt);
    // Scroll to form
    setTimeout(() => {
      document.getElementById('cron-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div className="overview-container" style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', padding: '10px' }}>
          <Clock size={24} color="#3b82f6" />
        </div>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>CRON Automations</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {jobs.length} active job{jobs.length !== 1 ? 's' : ''} — Agent executes tasks on your schedule
          </p>
        </div>
      </div>

      {/* Templates */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '12px' }}>
          QUICK TEMPLATES
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {TEMPLATES.map((t) => (
            <div
              key={t.label}
              onClick={() => applyTemplate(t)}
              style={{
                background: selectedTemplate === t.label ? `rgba(${t.color === '#3b82f6' ? '59,130,246' : t.color === '#10b981' ? '16,185,129' : t.color === '#f59e0b' ? '245,158,11' : t.color === '#8b5cf6' ? '139,92,246' : t.color === '#ef4444' ? '239,68,68' : '6,182,212'},0.15)` : 'var(--bg-secondary)',
                border: `1px solid ${selectedTemplate === t.label ? t.color : 'var(--glass-border)'}`,
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = t.color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = selectedTemplate === t.label ? t.color : 'var(--glass-border)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ color: t.color }}>{t.icon}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{t.label}</span>
              </div>
              <p style={{ margin: '0 0 8px 0', color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>{t.description}</p>
              <code style={{ fontSize: '0.75rem', color: t.color, background: 'transparent', border: `1px solid ${t.color}30`, padding: '2px 6px', borderRadius: '4px' }}>
                {t.expression} — {parseCronHuman(t.expression)}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* Create Form */}
      <div id="cron-form" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Plus size={18} color="var(--accent)" />
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>Create New Job</h3>

          {/* Mode Toggle */}
          <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              onClick={() => setMode('natural')}
              style={{ padding: '6px 14px', background: mode === 'natural' ? 'var(--accent)' : 'transparent', color: mode === 'natural' ? 'var(--accent-text)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.2s' }}
            >
              Natural Language
            </button>
            <button
              onClick={() => setMode('manual')}
              style={{ padding: '6px 14px', background: mode === 'manual' ? 'var(--accent)' : 'transparent', color: mode === 'manual' ? 'var(--accent-text)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.2s' }}
            >
              Manual
            </button>
          </div>
        </div>

        {mode === 'natural' ? (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>
              Describe what you want the agent to do and when. The agent will parse and schedule it automatically.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={nlInput}
                onChange={e => setNlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateFromNL()}
                placeholder='e.g. "Check my portfolio every Monday morning and send a summary"'
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
              />
              <button
                onClick={handleCreateFromNL}
                disabled={isCreating || !nlInput.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: isCreating || !nlInput.trim() ? 'not-allowed' : 'pointer', opacity: !nlInput.trim() ? 0.5 : 1 }}
              >
                {isCreating ? <Loader2 size={16} className="spinner" /> : <Send size={16} />}
                Schedule
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
              <div style={{ flex: '0 0 200px' }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.05em' }}>CRON EXPRESSION</label>
                <input
                  type="text"
                  value={cronExpr}
                  onChange={e => setCronExpr(e.target.value)}
                  placeholder="0 8 * * *"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--accent)', padding: '10px 12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.9rem', outline: 'none' }}
                />
                <div style={{ marginTop: '4px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  → {parseCronHuman(cronExpr)}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.05em' }}>AGENT INSTRUCTION</label>
                <textarea
                  value={promptInput}
                  onChange={e => setPromptInput(e.target.value)}
                  placeholder="What should the agent do when this job runs?"
                  rows={3}
                  style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '6px', fontSize: '0.875rem', resize: 'none', outline: 'none', lineHeight: 1.6 }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCreateManual}
                disabled={isCreating || !cronExpr.trim() || !promptInput.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: isCreating || !cronExpr.trim() || !promptInput.trim() ? 'not-allowed' : 'pointer', opacity: !cronExpr.trim() || !promptInput.trim() ? 0.5 : 1 }}
              >
                {isCreating ? <Loader2 size={16} className="spinner" /> : <Plus size={16} />}
                Create Job
              </button>
            </div>
          </div>
        )}

        {createStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', padding: '10px 14px', borderRadius: '6px', background: createStatus.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${createStatus.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            {createStatus.type === 'success' ? <CheckCircle size={16} color="#10b981" /> : <AlertCircle size={16} color="#ef4444" />}
            <span style={{ color: createStatus.type === 'success' ? '#10b981' : '#ef4444', fontSize: '0.875rem' }}>{createStatus.msg}</span>
          </div>
        )}
      </div>

      {/* Active Jobs */}
      <div>
        <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '12px' }}>
          ACTIVE JOBS ({jobs.length})
        </h3>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', padding: '24px' }}>
            <Loader2 size={18} className="spinner" /> Loading jobs...
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--glass-border)', borderRadius: '8px', padding: '40px', textAlign: 'center' }}>
            <Clock size={40} color="var(--text-secondary)" style={{ marginBottom: '12px', opacity: 0.4 }} />
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>No scheduled jobs yet.</p>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.7 }}>Pick a template above or create a custom job.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {jobs.map((job) => (
              <div
                key={job.id}
                style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '16px 20px', transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--glass-border)')}
              >
                {/* Status dot */}
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', flexShrink: 0 }} />

                {/* Cron expression */}
                <code style={{ color: 'var(--accent)', fontSize: '0.85rem', fontFamily: 'monospace', flexShrink: 0, minWidth: '110px' }}>
                  {job.expression}
                </code>

                {/* Human readable */}
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', flexShrink: 0, minWidth: '130px' }}>
                  {parseCronHuman(job.expression)}
                </span>

                {/* Prompt (truncated) */}
                <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {job.prompt}
                </span>

                {/* Created at */}
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', flexShrink: 0 }}>
                  {new Date(job.createdAt).toLocaleDateString()}
                </span>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(job.id)}
                  disabled={deletingId === job.id}
                  style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, transition: 'all 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {deletingId === job.id ? <Loader2 size={14} className="spinner" /> : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cron cheatsheet */}
      <div style={{ marginTop: '32px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '20px' }}>
        <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-secondary)', fontSize: '0.75rem', letterSpacing: '0.1em', fontWeight: 700 }}>CRON EXPRESSION CHEATSHEET</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {[
            ['* * * * *', 'Every minute'],
            ['0 * * * *', 'Every hour'],
            ['0 8 * * *', 'Daily at 8:00 AM'],
            ['0 8 * * 1', 'Every Monday 8 AM'],
            ['0 0 * * 0', 'Every Sunday midnight'],
            ['*/30 * * * *', 'Every 30 minutes'],
          ].map(([expr, desc]) => (
            <div key={expr} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <code
                style={{ color: 'var(--accent)', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}
                onClick={() => { setMode('manual'); setCronExpr(expr); document.getElementById('cron-form')?.scrollIntoView({ behavior: 'smooth' }); }}
                title="Click to use"
              >
                {expr}
              </code>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>→ {desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Cron;
