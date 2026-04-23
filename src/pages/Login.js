import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err?.code === 'auth/user-not-found'
        ? 'No account with this email. Please contact an administrator.'
        : err?.code === 'auth/invalid-credential'
          ? 'Incorrect email or password.'
          : err?.code === 'auth/invalid-login-credentials'
            ? 'Incorrect email or password.'
            : err?.code === 'auth/operation-not-allowed'
              ? 'Email/password sign-in is not enabled for this project.'
              : err?.code === 'auth/too-many-requests'
                ? 'Too many attempts. Please try again later.'
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
          <p>Sign in to continue</p>
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
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              minLength={6}
            />
          </label>
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Please wait…' : 'Sign In'}
          </button>
        </form>
        <p className="login-toggle">Accounts are provisioned by an administrator.</p>
      </div>
    </div>
  );
}
