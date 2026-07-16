import React from 'react';

interface LlmIconProps {
  provider: string;
  size?: number;
  className?: string;
  color?: string;
}

export const LlmIcon: React.FC<LlmIconProps> = ({ provider, size = 14, className, color = 'currentColor' }) => {
  const iconProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: color,
    className,
    xmlns: "http://www.w3.org/2000/svg"
  };

  switch (provider.toLowerCase()) {
    case 'gemini':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M12.031 0C12.455 7.031 17.032 11.608 24 12.032C16.969 12.456 12.392 17.033 11.968 24C11.544 17.033 6.967 12.456 0 12.032C6.967 11.608 11.544 7.031 12.031 0Z" />
        </svg>
      );
    case 'anthropic':
    case 'claude':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M20.25 19.344a1.85 1.85 0 0 1-1.849 1.854 1.85 1.85 0 0 1-1.85-1.854V12.18l-8.608 5.762a1.847 1.847 0 0 1-1.523.275 1.85 1.85 0 0 1-1.018-1.025 1.847 1.847 0 0 1 .28-1.52l5.772-8.544H4.3A1.85 1.85 0 0 1 2.45 5.275 1.85 1.85 0 0 1 4.3 3.424h15.95a1.85 1.85 0 0 1 1.849 1.85v14.07z" />
        </svg>
      );
    case 'openai':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2057 5.9847 5.9847 0 0 0 3.989-2.9 6.051 6.051 0 0 0-.7388-7.0732zM13.2599 22.5A4.4776 4.4776 0 0 1 9.421 20.354l7.1557-4.133v-1.1441l4.4764-2.5847a4.5613 4.5613 0 0 1 .4583 4.4447A4.4776 4.4776 0 0 1 13.2599 22.5zm-5.0645-1.9213l-7.1534-4.1317V8.1818l2.9734 1.7169 4.18 2.4131v8.267zm2.5034-4.3298V7.9818L6.5188 5.5687a4.4776 4.4776 0 0 1 1.9566-3.3855A4.4776 4.4776 0 0 1 13.2599 1.5c1.666 0 3.2206.9189 4.0205 2.4042l-2.091 1.2064-4.4906 2.593v8.545zM3.4687 14.887a4.4776 4.4776 0 0 1-.4583-4.4447 4.5613 4.5613 0 0 1 3.5188-2.454v8.2662l4.4764 2.5847v1.144l-7.1534 4.1318-.3835-.6268zM5.5687 6.5188l4.18-2.4132V1.5a4.4776 4.4776 0 0 1 4.7838-1.0494A4.4776 4.4776 0 0 1 17.4812 5.5687l-7.1534 4.1317zM20.5313 9.113a4.4776 4.4776 0 0 1 .4583 4.4447 4.5613 4.5613 0 0 1-3.5188 2.454v-8.2662l-4.4764-2.5847v-1.144l7.1534-4.1318.3835.6268z" />
        </svg>
      );
    case 'openrouter':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5zm0 7.5l-6-3v6.5l6 3 6-3V6.5l-6 3zM12 22l-10-5v-6l10 5 10-5v6z" />
        </svg>
      );
    case '9router':
      return (
        <svg {...iconProps} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
      );
    case 'ollama':
      return (
        <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 10h-2V6a4 4 0 0 0-8 0v4H6a4 4 0 0 0-4 4v4h12V14h6v-2a2 2 0 0 0-2-2z" />
          <circle cx="8" cy="14" r="1" fill={color} stroke="none" />
          <circle cx="12" cy="14" r="1" fill={color} stroke="none" />
        </svg>
      );
    case 'groq':
      return (
        <svg {...iconProps} viewBox="0 0 24 24" stroke={color} fill="none" strokeWidth="2.5" strokeLinecap="square">
          <path d="M21 12A9 9 0 1112 3a9 9 0 010 18z" />
          <path d="M15 12h-3v3" />
        </svg>
      );
    case 'mistral':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M3 21V3h4l5 8 5-8h4v18h-3V8l-6 9-6-9v13H3z" />
        </svg>
      );
    case 'xai':
    case 'grok':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    case 'deepseek':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14h-2v-4H7V8h4v8zm4-2h-2v-2h2v2zm0-4h-2V8h2v2z" />
        </svg>
      );
    default:
      return (
        <svg {...iconProps} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="1" x2="9" y2="4" />
          <line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" />
          <line x1="15" y1="20" x2="15" y2="23" />
          <line x1="20" y1="9" x2="23" y2="9" />
          <line x1="20" y1="14" x2="23" y2="14" />
          <line x1="1" y1="9" x2="4" y2="9" />
          <line x1="1" y1="14" x2="4" y2="14" />
        </svg>
      );
  }
};
