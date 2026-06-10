import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showLogin, setShowLogin] = useState(!user);

  const login = useCallback(async (username, password, rememberMe = false) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.success) {
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      // Remember me: save credentials for auto-login
      if (rememberMe) {
        localStorage.setItem('auth_remember', JSON.stringify({ username, password }));
      } else {
        localStorage.removeItem('auth_remember');
      }
      setUser(res.data.user);
      setShowLogin(false);
    }
    return res;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setShowLogin(true);
  }, []);

  const resetPassword = useCallback(async (username) => {
    const res = await api.post('/auth/reset-password', { username });
    return res;
  }, []);

  // Auto-login from remembered credentials
  useEffect(() => {
    if (user) return; // already logged in
    try {
      const remembered = localStorage.getItem('auth_remember');
      if (remembered) {
        const { username, password } = JSON.parse(remembered);
        if (username && password) {
          login(username, password, true).catch(() => {
            // Auto-login failed, clear remembered credentials
            localStorage.removeItem('auth_remember');
          });
        }
      }
    } catch {}
  }, []);

  // Listen for token expiry events
  useEffect(() => {
    const handler = () => {
      setUser(null);
      setShowLogin(true);
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, resetPassword, showLogin, setShowLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
