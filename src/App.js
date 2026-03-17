import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import FormPage from './pages/FormPage';
import DataSheet from './pages/DataSheet';
import Summaries from './pages/Summaries';
import './App.css';

function ProtectedRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth();
  const location = useLocation();
  if (authLoading) {
    return (
      <div className="app-loading">
        <p>Loading…</p>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: { pathname: location.pathname } }} replace />;
  }
  return children;
}

function Layout({ children }) {
  const { logout, user } = useAuth();
  const path = useLocation().pathname;

  return (
    <div className="app-layout">
      <nav className="app-nav">
        <div className="nav-brand">
          <Link to="/">Cordillera Ancestral Domains</Link>
        </div>
        <div className="nav-links">
          <Link to="/" className={path === '/' ? 'active' : ''}>Dashboard</Link>
          <Link to="/form" className={path === '/form' ? 'active' : ''}>Form</Link>
          <Link to="/data" className={path === '/data' ? 'active' : ''}>Data</Link>
          <span className="nav-user">{user?.displayName || user?.email}</span>
          <button type="button" className="btn-logout" onClick={logout}>Logout</button>
        </div>
      </nav>
      <main className="app-main">{children}</main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout><Summaries /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/form"
          element={
            <ProtectedRoute>
              <Layout><FormPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/data"
          element={
            <ProtectedRoute>
              <Layout><DataSheet /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/summaries"
          element={
            <ProtectedRoute>
              <Navigate to="/" replace />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
