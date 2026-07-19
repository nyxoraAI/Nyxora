import React, { useState, useEffect } from 'react';
import { ChevronRight, Terminal, Search, Activity, Cpu } from 'lucide-react';

export interface ProgressLog {
  text: string;
  time: number;
}

export interface AgentTraceProps {
  toolCalls?: any[];
  progressLogs?: ProgressLog[];
  isStreaming?: boolean;
}

export const AgentTrace: React.FC<AgentTraceProps> = ({ toolCalls = [], progressLogs = [], isStreaming = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [startTime] = useState<number>(Date.now());
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Auto expand when streaming starts
  useEffect(() => {
    if (isStreaming && (toolCalls.length > 0 || progressLogs.length > 0)) {
      setIsOpen(true);
    }
  }, [isStreaming]);

  // Track time if streaming
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming, startTime]);

  const hasContent = toolCalls.length > 0 || progressLogs.length > 0;
  
  if (!hasContent) {
    return null;
  }

  const getSummaryText = () => {
    if (isStreaming) {
      return `Thinking for ${elapsedTime}s`;
    }
    const count = toolCalls.length > 0 ? toolCalls.length : (progressLogs.filter(p => p.text.includes('Ran') || p.text.includes('Running') || p.text.includes('Explored')).length || 1);
    return `Worked for ${count} step${count > 1 ? 's' : ''}`;
  };

  const getIconForStep = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('find') || lower.includes('search') || lower.includes('explored')) return <Search size={14} color="#60a5fa" />;
    if (lower.includes('ran') || lower.includes('running') || lower.includes('execute')) return <Terminal size={14} color="#34d399" />;
    if (lower.includes('thought')) return <Cpu size={14} color="#f472b6" />;
    return <Activity size={14} color="#94a3b8" />;
  };

  // Merge history tool_calls into readable strings if progressLogs is empty
  const traces: string[] = [];
  
  if (progressLogs && progressLogs.length > 0) {
    // Clean up html tags in progress logs and add to traces
    progressLogs.forEach(log => {
      const cleanText = log.text.replace(/<[^>]*>?/gm, '').replace(/\*+/g, '').trim();
      if (cleanText) traces.push(cleanText);
    });
  } else if (toolCalls && toolCalls.length > 0) {
    toolCalls.forEach(tool => {
      traces.push(`Ran ${tool.function?.name || 'tool'}`);
    });
  }

  return (
    <div className="agent-trace-container" style={{ marginBottom: 0 }}>
      <div 
        className="agent-trace-header" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', width: 'fit-content' }}
      >
        <div className="agent-trace-summary" style={{ fontSize: '0.85rem', fontWeight: 500 }}>
          {getSummaryText()}
        </div>
        <div className="agent-trace-chevron" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'flex' }}>
          <ChevronRight size={14} className="agent-trace-icon" />
        </div>
      </div>
      
      {isOpen && (
        <div className="agent-trace-body" style={{ marginTop: '8px', paddingLeft: '14px', marginLeft: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {traces.map((trace, idx) => (
            <div key={idx} className="trace-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              {getIconForStep(trace)}
              <span>{trace}</span>
            </div>
          ))}
          {isStreaming && (
            <div className="trace-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <span className="working-dots">Working</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
