import React, { createContext, useContext, useState, useCallback } from 'react';
import { isJwtExpired } from '../utils/jwt';

const AuthContext = createContext(null);

const TOKEN_KEY = 'edr_token';
const USER_KEY = 'edr_user';
const TENANT_KEY = 'edr_selected_tenant';

function readStoredSession() {
  const t = localStorage.getItem(TOKEN_KEY);
  if (!t) return { token: null, user: null };
  if (isJwtExpired(t)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_KEY);
    return { token: null, user: null };
  }
  try {
    const u = localStorage.getItem(USER_KEY);
    return { token: t, user: u ? JSON.parse(u) : null };
  } catch {
    return { token: t, user: null };
  }
}

let admin401Redirecting = false;

export function AuthProvider({ children }) {
  const initial = readStoredSession();
  const [token, setToken] = useState(initial.token);
  const [user, setUser] = useState(initial.user);
  const [selectedTenantId, setSelectedTenantIdState] = useState(() => {
    const v = localStorage.getItem(TENANT_KEY);
    return v ? parseInt(v, 10) : null;
  });

  const setSelectedTenantId = useCallback((id) => {
    if (id == null) {
      localStorage.removeItem(TENANT_KEY);
      setSelectedTenantIdState(null);
    } else {
      localStorage.setItem(TENANT_KEY, String(id));
      setSelectedTenantIdState(id);
    }
  }, []);

  const login = async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    admin401Redirecting = false;
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_KEY);
    setToken(null);
    setUser(null);
    setSelectedTenantIdState(null);
  }, []);

  const api = useCallback(
    (path, options = {}) => {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      };
      if (user?.role === 'super_admin' && selectedTenantId != null) {
        headers['X-Tenant-Id'] = String(selectedTenantId);
      }
      return fetch(path, { ...options, headers }).then((res) => {
        if (res.status === 401 && /\/api\/admin\b/.test(path) && !admin401Redirecting) {
          admin401Redirecting = true;
          logout();
          if (window.location.pathname !== '/login') {
            window.location.replace('/login');
          }
        }
        return res;
      });
    },
    [token, user?.role, selectedTenantId, logout]
  );

  return (
    <AuthContext.Provider value={{ token, user, login, logout, api, selectedTenantId, setSelectedTenantId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
