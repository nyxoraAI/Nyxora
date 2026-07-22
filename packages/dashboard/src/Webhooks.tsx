import React, { useState, useEffect } from 'react';
import {
  Network, MessageSquare, Hash, Eye, EyeOff, Save,
  CheckCircle, AlertCircle, Loader2, ExternalLink,
  Send, Phone, Monitor, Bot, Radio, Coffee, Globe,
  Zap, Smartphone, Music, Video, Lock, Info
} from 'lucide-react';
import { apiFetch } from './utils/api';

interface TelegramConfig { enabled: boolean; bot_token?: string; authorized_chat_id?: number; }
interface DiscordConfig  { enabled: boolean; bot_token?: string; client_id?: string; }
interface FullConfig { integrations?: { telegram?: TelegramConfig; discord?: DiscordConfig; [k: string]: any }; [k: string]: any; }

// ─── channel catalogue ────────────────────────────────────────────────────────
interface ChannelInfo {
  id: string; label: string; icon: React.ReactNode;
  color: string; status: 'live' | 'beta' | 'planned';
  description: string; docsUrl?: string;
}

const CHANNELS: ChannelInfo[] = [
  { id: 'telegram', label: 'Telegram', icon: <MessageSquare size={22} />, color: '#2AABEE', status: 'live', description: 'Full bot integration with push notifications, transaction confirmations, and streaming responses.' },
  { id: 'discord',  label: 'Discord',  icon: <Hash size={22} />,          color: '#5865F2', status: 'live', description: 'Bot for Discord servers and DMs. Supports slash commands and message content intent.' },
  { id: 'whatsapp', label: 'WhatsApp', icon: <Send size={22} />,          color: '#25D366', status: 'beta', description: 'Connect via Baileys (unofficial). Install baileys separately to enable.', docsUrl: 'https://github.com/WhiskeySockets/Baileys' },
  { id: 'slack',    label: 'Slack',    icon: <Hash size={22} />,          color: '#4A154B', status: 'beta', description: 'Slack Bot using socket mode. Requires bot_token and app_token.', docsUrl: 'https://api.slack.com/apps' },
  { id: 'msteams',  label: 'MS Teams', icon: <Monitor size={22} />,       color: '#6264A7', status: 'planned', description: 'Microsoft Teams webhook adapter.' },
  { id: 'matrix',   label: 'Matrix',   icon: <Globe size={22} />,         color: '#0DBD8B', status: 'planned', description: 'Matrix / Element protocol adapter.' },
  { id: 'imessage', label: 'iMessage', icon: <Smartphone size={22} />,    color: '#34C759', status: 'planned', description: 'Apple iMessage integration (macOS only).' },
  { id: 'line',     label: 'LINE',     icon: <MessageSquare size={22} />, color: '#06C755', status: 'planned', description: 'LINE Messaging API adapter.' },
  { id: 'googlechat', label: 'Google Chat', icon: <Coffee size={22} />,   color: '#4285F4', status: 'planned', description: 'Google Chat bot using webhook or App Framework.' },
  { id: 'mattermost', label: 'Mattermost', icon: <Radio size={22} />,     color: '#0058CC', status: 'planned', description: 'Mattermost self-hosted chat adapter.' },
  { id: 'nostr',    label: 'Nostr',    icon: <Zap size={22} />,           color: '#7B68EE', status: 'planned', description: 'Decentralized Nostr protocol.' },
  { id: 'twitch',   label: 'Twitch',   icon: <Video size={22} />,         color: '#9146FF', status: 'planned', description: 'Twitch chat bot.' },
  { id: 'qqbot',    label: 'QQ Bot',   icon: <Bot size={22} />,           color: '#12B7F5', status: 'planned', description: 'Tencent QQ bot adapter.' },
  { id: 'irc',      label: 'IRC',      icon: <Radio size={22} />,         color: '#999999', status: 'planned', description: 'Internet Relay Chat adapter.' },
  { id: 'sms',      label: 'SMS / Twilio', icon: <Phone size={22} />,    color: '#F22F46', status: 'planned', description: 'SMS via Twilio webhook. Exposes port 3012.' },
  { id: 'voicecall', label: 'Voice Call', icon: <Phone size={22} />,      color: '#FF6B35', status: 'planned', description: 'Inbound voice call via webhook. Exposes port 3013.' },
  { id: 'zalo',     label: 'Zalo',     icon: <MessageSquare size={22} />, color: '#0068FF', status: 'planned', description: 'Zalo OA API webhook adapter. Exposes port 3011.' },
  { id: 'nextcloudtalk', label: 'Nextcloud Talk', icon: <Globe size={22} />, color: '#0082C9', status: 'planned', description: 'Self-hosted Nextcloud Talk adapter.' },
  { id: 'synologychat', label: 'Synology Chat', icon: <Globe size={22} />, color: '#B5A642', status: 'planned', description: 'Synology Chat incoming webhook.' },
];

const StatusBadge: React.FC<{ status: ChannelInfo['status'] }> = ({ status }) => {
  const map = {
    live:    { label: 'LIVE',    bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.3)' },
    beta:    { label: 'BETA',    bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
    planned: { label: 'PLANNED', bg: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: 'rgba(107,114,128,0.3)' },
  }[status];
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: '4px', background: map.bg, color: map.color, border: `1px solid ${map.border}` }}>
      {map.label}
    </span>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'transparent',
  border: '1px solid var(--glass-border)', color: 'var(--text-primary)',
  padding: '10px 12px', borderRadius: '6px', fontFamily: 'monospace',
  fontSize: '0.875rem', outline: 'none'
};

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
  <div onClick={() => onChange(!value)} style={{ width: '44px', height: '24px', borderRadius: '12px', background: value ? 'var(--accent)' : 'var(--glass-border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
    <div style={{ position: 'absolute', top: '3px', left: value ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: value ? 'var(--accent-text)' : 'var(--text-secondary)', transition: 'left 0.2s' }} />
  </div>
);

// ─── main component ───────────────────────────────────────────────────────────
const Webhooks: React.FC = () => {
  const [config, setConfig] = useState<FullConfig | null>(null);
  const [telegram, setTelegram] = useState<TelegramConfig>({ enabled: false, bot_token: '', authorized_chat_id: undefined });
  const [discord, setDiscord] = useState<DiscordConfig>({ enabled: false, bot_token: '', client_id: '' });
  const [showTgToken, setShowTgToken] = useState(false);
  const [showDsToken, setShowDsToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [expandedChannel, setExpandedChannel] = useState<string | null>('telegram');

  useEffect(() => {
    apiFetch('/api/config').then(r => r.json()).then((cfg: FullConfig) => {
      setConfig(cfg);
      if (cfg.integrations?.telegram) setTelegram({ enabled: cfg.integrations.telegram.enabled ?? false, bot_token: cfg.integrations.telegram.bot_token || '', authorized_chat_id: cfg.integrations.telegram.authorized_chat_id });
      if (cfg.integrations?.discord) setDiscord({ enabled: cfg.integrations.discord.enabled ?? false, bot_token: cfg.integrations.discord.bot_token || '', client_id: cfg.integrations.discord.client_id || '' });
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true); setStatus(null);
    try {
      const payload = { ...config, integrations: { ...config.integrations, telegram, discord } };
      const res = await apiFetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { setConfig(payload); setStatus({ type: 'success', msg: 'Saved! Restart backend to apply.' }); }
      else setStatus({ type: 'error', msg: 'Failed to save.' });
    } catch { setStatus({ type: 'error', msg: 'Connection error.' }); }
    finally { setSaving(false); }
  };

  const liveCount = CHANNELS.filter(c => c.status === 'live').length;
  const betaCount = CHANNELS.filter(c => c.status === 'beta').length;

  return (
    <div className="overview-container" style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', padding: '10px' }}>
            <Network size={24} color="#3b82f6" />
          </div>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>Channels & Webhooks</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {liveCount} live · {betaCount} beta · {CHANNELS.length - liveCount - betaCount} planned
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {status && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: status.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
              {status.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {status.msg}
            </div>
          )}
          <button onClick={handleSave} disabled={saving || !config}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
            Save
          </button>
        </div>
      </div>

      {/* Channel grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {CHANNELS.map(ch => {
          const isExpanded = expandedChannel === ch.id;
          const isLive = ch.status === 'live';
          const isBeta = ch.status === 'beta';
          const canExpand = isLive || isBeta;

          return (
            <div key={ch.id}
              style={{ background: 'var(--bg-secondary)', border: `1px solid ${isExpanded && canExpand ? ch.color : 'var(--glass-border)'}`, borderRadius: '8px', overflow: 'hidden', transition: 'border-color 0.2s' }}>

              {/* Row header */}
              <div
                onClick={() => canExpand && setExpandedChannel(isExpanded ? null : ch.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', cursor: canExpand ? 'pointer' : 'default', userSelect: 'none' }}
              >
                <span style={{ color: canExpand ? ch.color : 'var(--text-secondary)' }}>{ch.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>{ch.label}</span>
                    <StatusBadge status={ch.status} />
                  </div>
                  <p style={{ margin: '2px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{ch.description}</p>
                </div>

                {/* enabled badge for live channels */}
                {ch.id === 'telegram' && (
                  <span style={{ fontSize: '0.75rem', color: telegram.enabled ? '#10b981' : 'var(--text-secondary)' }}>
                    {telegram.enabled ? '● Enabled' : '○ Disabled'}
                  </span>
                )}
                {ch.id === 'discord' && (
                  <span style={{ fontSize: '0.75rem', color: discord.enabled ? '#10b981' : 'var(--text-secondary)' }}>
                    {discord.enabled ? '● Enabled' : '○ Disabled'}
                  </span>
                )}

                {ch.docsUrl && (
                  <a href={ch.docsUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    style={{ color: 'var(--text-secondary)', display: 'flex' }}>
                    <ExternalLink size={14} />
                  </a>
                )}
                {canExpand && (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{isExpanded ? '▲' : '▼'}</span>
                )}
              </div>

              {/* Expanded: Telegram */}
              {isExpanded && ch.id === 'telegram' && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', marginBottom: '16px' }}>
                    <Toggle value={telegram.enabled} onChange={v => setTelegram(p => ({ ...p, enabled: v }))} />
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Enable Telegram Bot</span>
                  </div>
                  {telegram.enabled && (
                    <>
                      <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>BOT TOKEN</label>
                      <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <input type={showTgToken ? 'text' : 'password'} value={telegram.bot_token || ''} onChange={e => setTelegram(p => ({ ...p, bot_token: e.target.value }))} placeholder="1234567890:ABCDEFghijklmno..." style={{ ...inputStyle, paddingRight: '42px' }} />
                        <button onClick={() => setShowTgToken(!showTgToken)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}>
                          {showTgToken ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>AUTHORIZED CHAT ID</label>
                      <input type="number" value={telegram.authorized_chat_id || ''} onChange={e => setTelegram(p => ({ ...p, authorized_chat_id: e.target.value ? parseInt(e.target.value) : undefined }))} placeholder="123456789" style={{ ...inputStyle, marginBottom: '12px' }} />
                      <div style={{ background: 'rgba(42,171,238,0.06)', border: '1px solid rgba(42,171,238,0.15)', borderRadius: '6px', padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        1. Open Telegram → <code>@BotFather</code> → <code>/newbot</code> → copy token<br />
                        2. Get your Chat ID from <code>@userinfobot</code><br />
                        3. Save &amp; restart backend
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Expanded: Discord */}
              {isExpanded && ch.id === 'discord' && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', marginBottom: '16px' }}>
                    <Toggle value={discord.enabled} onChange={v => setDiscord(p => ({ ...p, enabled: v }))} />
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Enable Discord Bot</span>
                  </div>
                  {discord.enabled && (
                    <>
                      <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>BOT TOKEN</label>
                      <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <input type={showDsToken ? 'text' : 'password'} value={discord.bot_token || ''} onChange={e => setDiscord(p => ({ ...p, bot_token: e.target.value }))} placeholder="MTA0ODU2NTk3..." style={{ ...inputStyle, paddingRight: '42px' }} />
                        <button onClick={() => setShowDsToken(!showDsToken)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}>
                          {showDsToken ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>CLIENT ID</label>
                      <input type="text" value={discord.client_id || ''} onChange={e => setDiscord(p => ({ ...p, client_id: e.target.value }))} placeholder="1048565974797..." style={{ ...inputStyle, marginBottom: '12px' }} />
                      <div style={{ background: 'rgba(88,101,242,0.06)', border: '1px solid rgba(88,101,242,0.15)', borderRadius: '6px', padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        1. <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" style={{ color: '#5865F2' }}>discord.com/developers</a> → New Application → Bot → Reset Token<br />
                        2. Enable <strong>Message Content Intent</strong><br />
                        3. OAuth2 → Bot → invite to server → Save &amp; restart
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Expanded: Beta channels (WhatsApp, Slack) */}
              {isExpanded && ch.status === 'beta' && (
                <div style={{ padding: '0 20px 16px', borderTop: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '6px' }}>
                    <Info size={14} color="#f59e0b" />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                      This channel adapter is implemented but requires manual configuration in <code>~/.nyxora/config/config.yaml</code> under <code>integrations.{ch.id}</code>. Configuration UI coming soon.
                      {ch.docsUrl && <> <a href={ch.docsUrl} target="_blank" rel="noopener noreferrer" style={{ color: ch.color }}>View docs ↗</a></>}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div style={{ marginTop: '24px', padding: '12px 16px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        ⚠️ Credential changes require a <strong style={{ color: 'var(--text-primary)' }}>backend restart</strong>. Tokens are encrypted in <code>~/.nyxora/config/config.yaml</code>.
      </div>
    </div>
  );
};

export default Webhooks;
