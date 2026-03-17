import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { login, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, displayName || undefined);
      } else {
        await login(email, password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err?.code === 'auth/user-not-found'
        ? 'No account with this email. Create an account instead.'
        : err?.code === 'auth/email-already-in-use'
          ? 'This email is already registered. Sign in instead.'
          : err?.message ?? 'Sign in failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Cordillera Ancestral Domains</h1>
          <p>{isSignUp ? 'Create an account' : 'Sign in to continue'}</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />
          </label>
          {isSignUp && (
            <label>
              Display name
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                placeholder="Your name"
              />
            </label>
          )}
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              minLength={6}
            />
          </label>
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign In'}
          </button>
        </form>
        <button
          type="button"
          className="login-toggle"
          onClick={() => {
            setIsSignUp((v) => !v);
            setError('');
          }}
        >
          {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>
      </div>
    </div>
  );
}
