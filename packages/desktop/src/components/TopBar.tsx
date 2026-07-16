import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import './TopBar.css';

interface TopBarProps {
  title?: string;
  children?: React.ReactNode;
  rightChildren?: React.ReactNode;
}

export function TopBar({ title, children, rightChildren }: TopBarProps) {
  const handleControl = (action: string) => {
    if ((window as any).ipcRenderer) {
      (window as any).ipcRenderer.send('window-control', action);
    }
  };

  return (
    <div className="desktop-top-bar draggable-region">
      <div className="top-bar-content" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        {title && <span className="top-bar-title">{title}</span>}
        {children}
      </div>
      
      <div className="top-bar-right-content no-drag" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {rightChildren}
      </div>

      {/* Window Controls */}
      <div className="window-controls no-drag macos-style">
        <button className="window-control-btn minimize-btn" onClick={() => handleControl('minimize')} title="Minimize">
          <Minus size={10} className="control-icon" />
        </button>
        <button className="window-control-btn maximize-btn" onClick={() => handleControl('maximize')} title="Maximize">
          <Square size={8} className="control-icon" />
        </button>
        <button className="window-control-btn close-btn" onClick={() => handleControl('close')} title="Close">
          <X size={10} className="control-icon" />
        </button>
      </div>
    </div>
  );
}
