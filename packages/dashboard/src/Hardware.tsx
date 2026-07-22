import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Monitor, Server, Activity, Thermometer, Clock, Database, Wifi, Zap } from 'lucide-react';
import { apiFetch } from './utils/api';
import { usePolling } from './utils/usePolling';

interface HardwareStats {
  cpu: {
    cores: number;
    model: string;
    loadAvg: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
  };
  disk?: {
    total: number;
    used: number;
    free: number;
  };
  network?: {
    rx_sec: number;
    tx_sec: number;
  };
  gpu?: {
    model: string;
    utilization: number;
    memoryTotal: number;
    memoryUsed: number;
  };
  uptime: number;
  platform: string;
  release: string;
}

export const Hardware: React.FC = () => {
  const [stats, setStats] = useState<HardwareStats | null>(null);

  const fetchStats = async () => {
    try {
      const res = await apiFetch('/api/hardware/stats');
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {
      // ignore
    }
  };

  usePolling(fetchStats, 2000);

  if (!stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
        <Activity size={24} className="animate-spin" style={{ marginRight: '12px' }} />
        Initializing Hardware Telemetry...
      </div>
    );
  }

  const memPercent = (stats.memory.used / stats.memory.total) * 100;
  const gbUsed = (stats.memory.used / (1024 ** 3)).toFixed(1);
  const gbTotal = (stats.memory.total / (1024 ** 3)).toFixed(1);
  
  // CPU Load average for 1 min (mocked out of 100% based on core count)
  const cpuPercent = Math.min((stats.cpu.loadAvg[0] / stats.cpu.cores) * 100, 100);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const getHealthColor = (percent: number) => {
    if (percent > 85) return '#ef4444';
    if (percent > 65) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="overview-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '10px' }}>
            <Monitor size={24} color="#10b981" />
          </div>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>Hardware Monitor</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Real-time physical resource utilization and node health telemetry.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={14} color="var(--text-secondary)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{stats.platform.toUpperCase()} {stats.release}</span>
          </div>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={14} color="var(--text-secondary)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>UPTIME: {formatUptime(stats.uptime)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        
        {/* CPU Panel */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20%', right: '-10%', opacity: 0.05, transform: 'scale(2)' }}>
            <Cpu size={200} />
          </div>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
            <Cpu size={20} color="var(--accent)" /> Central Processing Unit
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: getHealthColor(cpuPercent), lineHeight: 1 }}>
              {cpuPercent.toFixed(1)}%
            </div>
            <div style={{ paddingBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em' }}>
              LOAD AVERAGE
            </div>
          </div>

          <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ width: `${cpuPercent}%`, height: '100%', background: getHealthColor(cpuPercent), transition: 'width 1s ease-in-out, background 1s ease' }}></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '16px' }}>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', minWidth: 0 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>MODEL</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={stats.cpu.model}>
                {stats.cpu.model}
              </div>
            </div>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', minWidth: 0 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>CORES</div>
              <div style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.cpu.cores} Physical Cores</div>
            </div>
          </div>
        </div>

        {/* Memory Panel */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20%', right: '-10%', opacity: 0.05, transform: 'scale(2)' }}>
            <HardDrive size={200} />
          </div>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
            <HardDrive size={20} color="#8b5cf6" /> System Memory (RAM)
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: getHealthColor(memPercent), lineHeight: 1 }}>
              {memPercent.toFixed(1)}%
            </div>
            <div style={{ paddingBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em' }}>
              UTILIZATION
            </div>
          </div>

          <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ width: `${memPercent}%`, height: '100%', background: getHealthColor(memPercent), transition: 'width 1s ease-in-out, background 1s ease' }}></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', minWidth: 0 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>USED MEMORY</div>
              <div style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gbUsed} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>GB</span></div>
            </div>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', minWidth: 0 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>TOTAL MEMORY</div>
              <div style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gbTotal} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>GB</span></div>
            </div>
          </div>
        </div>

        {/* GPU Panel (If Available) */}
        {stats.gpu && (
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-20%', right: '-10%', opacity: 0.05, transform: 'scale(2)' }}>
              <Zap size={200} />
            </div>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
              <Zap size={20} color="#f59e0b" /> Graphics Processing Unit (GPU)
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: getHealthColor(stats.gpu.utilization), lineHeight: 1 }}>
                {stats.gpu.utilization.toFixed(1)}%
              </div>
              <div style={{ paddingBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                CORE UTILIZATION
              </div>
            </div>

            <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden', marginBottom: '24px' }}>
              <div style={{ width: `${stats.gpu.utilization}%`, height: '100%', background: getHealthColor(stats.gpu.utilization), transition: 'width 1s ease-in-out, background 1s ease' }}></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.2fr)', gap: '16px' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>MODEL</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={stats.gpu.model}>
                  {stats.gpu.model}
                </div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px', whiteSpace: 'nowrap' }}>VRAM USAGE</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(stats.gpu.memoryUsed / 1024).toFixed(1)} / {(stats.gpu.memoryTotal / 1024).toFixed(1)} GB
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Disk Panel (If Available) */}
        {stats.disk && (
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-20%', right: '-10%', opacity: 0.05, transform: 'scale(2)' }}>
              <Database size={200} />
            </div>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
              <Database size={20} color="#ec4899" /> Primary Storage
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: getHealthColor((stats.disk.used / stats.disk.total) * 100), lineHeight: 1 }}>
                {((stats.disk.used / stats.disk.total) * 100).toFixed(1)}%
              </div>
              <div style={{ paddingBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                USED
              </div>
            </div>

            <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden', marginBottom: '24px' }}>
              <div style={{ width: `${(stats.disk.used / stats.disk.total) * 100}%`, height: '100%', background: getHealthColor((stats.disk.used / stats.disk.total) * 100), transition: 'width 1s ease-in-out, background 1s ease' }}></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>USED</div>
                <div style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(stats.disk.used / (1024 ** 3)).toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>GB</span>
                </div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>TOTAL</div>
                <div style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(stats.disk.total / (1024 ** 3)).toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>GB</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Network Panel (If Available) */}
        {stats.network && (
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-20%', right: '-10%', opacity: 0.05, transform: 'scale(2)' }}>
              <Wifi size={200} />
            </div>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
              <Wifi size={20} color="#06b6d4" /> Network Traffic
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: '#06b6d4', lineHeight: 1 }}>
                {stats.network.rx_sec.toFixed(0)}
              </div>
              <div style={{ paddingBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                Mbps (RX)
              </div>
            </div>

            <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden', marginBottom: '24px' }}>
              <div style={{ width: `100%`, height: '100%', background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)', backgroundSize: '200% 100%', animation: 'shimmer 2s infinite linear' }}></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>DOWNLOAD (RX)</div>
                <div style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {stats.network.rx_sec.toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Mbps</span>
                </div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>UPLOAD (TX)</div>
                <div style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {stats.network.tx_sec.toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Mbps</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Alert Banner */}
      {(cpuPercent > 90 || memPercent > 90) && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '16px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Thermometer size={20} color="#ef4444" />
          <div style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 600 }}>
            CRITICAL WARNING: System resources are highly saturated. Running complex agents or local LLMs may cause crashes.
          </div>
        </div>
      )}

    </div>
  );
};

export default Hardware;
