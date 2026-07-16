import React, { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import NyxoraLogo from './NyxoraLogo';
import { apiFetch } from './utils/api';
import './Login.css';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Store the session token so all subsequent API calls are authenticated
        if (data.token) {
          localStorage.setItem('nyxora_token', data.token);
        }
        onLogin();
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch (err) {
      setError('Connection failed. Please check backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-card-header">
          <div className="mac-dot red"></div>
          <div className="mac-dot yellow"></div>
          <div className="mac-dot green"></div>
        </div>
        <div className="login-card-body">
          <div className="login-logo">
            <NyxoraLogo size={64} color="var(--accent)" />
          </div>
          <h2 className="login-title">Nyxora Dashboard</h2>
          <p className="login-subtitle">Enter your password to unlock the command center</p>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="login-input-group">
              <Lock size={18} className="login-input-icon" />
              <input 
                type="password" 
                className="login-input" 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            
            <button type="submit" className="login-button" disabled={loading || !password.trim()}>
              {loading ? 'Unlocking...' : 'Unlock'} <ArrowRight size={18} />
            </button>
            
            <div className="login-error">
              {error}
            </div>
          </form>

          <div className="login-hint">
            Default password is 123456
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
