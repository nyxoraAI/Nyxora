import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileCode, Search, Terminal, Activity, Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { parse as markedParse } from 'marked';

interface AgentTraceProps {
  reasoning?: string;
  tools?: any[];
  progress?: string;
  isStreaming?: boolean;
}

export const AgentTrace: React.FC<AgentTraceProps> = ({ reasoning, tools, progress, isStreaming }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<number, boolean>>({});

  const hasContent = (reasoning && reasoning.trim() !== '') || (tools && tools.length > 0) || progress;
  if (!hasContent) return null;

  const fileCount = tools?.filter(t => t.function.name === 'view_file' || t.function.name === 'read_file').length || 0;
  const searchCount = tools?.filter(t => t.function.name === 'grep_search' || t.function.name === 'search_web').length || 0;
  
  let summaryText = 'Working...';
  if (!isStreaming) {
    if (fileCount > 0 || searchCount > 0) {
      summaryText = `Exploring ${fileCount} file${fileCount !== 1 ? 's' : ''}, ${searchCount} search${searchCount !== 1 ? 'es' : ''}`;
    } else if (tools && tools.length > 0) {
      summaryText = `Executed ${tools.length} tool${tools.length > 1 ? 's' : ''}`;
    } else {
      summaryText = 'Analyzed request';
    }
  } else if (progress) {
    // Strip markdown for summary
    summaryText = progress.replace(/[_*]/g, '');
  }

  // Split reasoning into thought blocks (if they are separated by something, or just one big thought)
  // For now, we'll treat the whole reasoning as one "Thought" block if it exists
  const thoughtBlocks = reasoning && reasoning.trim() ? [reasoning.trim()] : [];

  const toggleThought = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedThoughts(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const renderToolArgs = (tool: any) => {
    try {
      const args = typeof tool.function.arguments === 'string' 
        ? JSON.parse(tool.function.arguments) 
        : tool.function.arguments;
        
      if (tool.function.name === 'view_file' || tool.function.name === 'read_file') {
        const pathParts = (args.AbsolutePath || args.TargetFile || args.path || '').split('/');
        const file = pathParts[pathParts.length - 1] || 'file';
        return `Analyzed ${file} ${args.StartLine ? `#L${args.StartLine}-${args.EndLine || 'end'}` : ''}`;
      }
      if (tool.function.name === 'grep_search' || tool.function.name === 'search_web') {
        return `Searched = "${args.Query || args.query || ''}"`;
      }
      if (tool.function.name === 'run_command' || tool.function.name === 'execute_bash') {
        const cmd = args.CommandLine || args.command || '';
        return `Executed: ${cmd.length > 30 ? cmd.substring(0, 30) + '...' : cmd}`;
      }
      return `Used ${tool.function.name}`;
    } catch {
      return `Used ${tool.function.name}`;
    }
  };

  const getToolIcon = (name: string) => {
    if (name === 'view_file' || name === 'read_file' || name === 'replace_file_content' || name === 'write_to_file') return <FileCode size={14} className="trace-icon" />;
    if (name === 'grep_search' || name === 'search_web') return <Search size={14} className="trace-icon" />;
    if (name === 'run_command' || name === 'execute_bash') return <Terminal size={14} className="trace-icon" />;
    return <Activity size={14} className="trace-icon" />;
  };

  return (
    <div className="agent-trace-container">
      <div 
        className="agent-trace-header" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="agent-trace-summary">
          {summaryText}
        </div>
        <div className="agent-trace-chevron">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>
      
      {isExpanded && (
        <div className="agent-trace-body">
          {thoughtBlocks.map((thought, idx) => {
             // Calculate a rough thought time based on string length just for aesthetic if streaming is done
             const roughTime = Math.max(1, Math.floor(thought.length / 50));
             const isThoughtExpanded = expandedThoughts[idx];
             
             return (
               <div key={`thought-${idx}`} className="trace-item-container">
                 <div className="trace-item thought-header" onClick={(e) => toggleThought(idx, e)}>
                   <span className="trace-text">Thought for {roughTime}s</span>
                   {isThoughtExpanded ? <ChevronDown size={12} className="trace-icon-chev" /> : <ChevronRight size={12} className="trace-icon-chev" />}
                 </div>
                 {isThoughtExpanded && (
                   <div className="trace-thought-content markdown-body" style={{ fontSize: '0.85rem' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(markedParse(thought) as string) }} />
                 )}
               </div>
             );
          })}
          
          {tools?.map((tool, idx) => {
            // Deduplicate same tool calls if they are perfectly identical, or just list them
            return (
              <div key={`tool-${idx}`} className="trace-item">
                {getToolIcon(tool.function.name)}
                <span className="trace-text">{renderToolArgs(tool)}</span>
              </div>
            );
          })}
          
          {isStreaming && (
            <div className="trace-item working">
              <Loader2 size={12} className="trace-spinner" />
              <span className="trace-text">{progress ? progress.replace(/[_*]/g, '') : 'Working'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
