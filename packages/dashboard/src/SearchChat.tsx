import React, { useState, useMemo } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import './SearchChat.css';

interface SearchChatProps {
  chatSessions: any[];
  onSelectSession: (id: string) => void;
}

const SearchChat: React.FC<SearchChatProps> = ({ chatSessions, onSelectSession }) => {
  const [query, setQuery] = useState('');

  const filteredSessions = useMemo(() => {
    if (!query.trim()) return chatSessions;
    const lowerQuery = query.toLowerCase();
    return chatSessions.filter(session => 
      session.title && session.title.toLowerCase().includes(lowerQuery)
    );
  }, [chatSessions, query]);

  return (
    <div className="search-chat-container">
      <div className="search-chat-header">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Telusuri percakapan"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="search-results-area">
        {filteredSessions.length > 0 ? (
          <div className="search-results-list">
            <h3 className="search-results-title">Terbaru</h3>
            {filteredSessions.map(session => (
              <div 
                key={session.id} 
                className="search-result-item"
                onClick={() => onSelectSession(session.id)}
              >
                <div className="result-title">
                  <MessageSquare size={16} className="result-icon" />
                  <span>{session.title}</span>
                </div>
                {/* Optional: Add a date or timestamp here if available in your session object */}
              </div>
            ))}
          </div>
        ) : (
          <div className="search-no-results">
            Tidak ada percakapan yang cocok dengan "{query}"
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchChat;
