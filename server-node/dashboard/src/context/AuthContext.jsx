import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { isJwtExpired } from '../utils/jwt';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

const TOKEN_KEY = 'edr_token';
const REFRESH_KEY = 'edr_refresh_token';
const USER_KEY = 'edr_user';
const TENANT_KEY = 'edr_selected_tenant';

let admin401Redirecting = false;
let refreshInFlight = null;

function readUser() {
  try {
    const u = localStorage.getItem(USER_KEY);
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

/** Load session from storage; may include expired access token if refresh is still valid. */
function readStoredSession() {
  const t = localStorage.getItem(TOKEN_KEY);
  const rt = localStorage.getItem(REFRESH_KEY);
  const user = readUser();
  if (t && !isJwtExpired(t)) {
    return { token: t, user, refreshToken: rt };
  }
  if (t && rt && !isJwtExpired(rt)) {
    return { token: t, user, refreshToken: rt, needsRefresh: true };
  }
  if (rt && !isJwtExpired(rt) && (!t || isJwtExpired(t))) {
    return { token: t, user, refreshToken: rt, needsRefresh: true };
  }
  if (t && isJwtExpired(t) && !rt) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_KEY);
  }
  return { token: null, user: null, refreshToken: null };
}

export function AuthProvider({ children }) {
  const { addToast } = useToast();
  const initial = readStoredSession();
  const [token, setToken] = useState(initial.token);
  const [user, setUser] = useState(initial.user);
  const [permissions, setPermissions] = useState([]);
  const [sessionReady, setSessionReady] = useState(false);
  const tokenRef = useRef(token);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

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

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_KEY);
    setToken(null);
    setUser(null);
    setPermissions([]);
    setSelectedTenantIdState(null);
    tokenRef.current = null;
  }, []);

  const tryRefresh = useCallback(async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt || isJwtExpired(rt)) return false;
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const r = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt }),
        });
        if (!r.ok) return false;
        const d = await r.json();
        localStorage.setItem(TOKEN_KEY, d.token);
        if (d.refresh_token) localStorage.setItem(REFRESH_KEY, d.refresh_token);
        else localStorage.removeItem(REFRESH_KEY);
        localStorage.setItem(USER_KEY, JSON.stringify(d.user));
        setToken(d.token);
        setUser(d.user);
        tokenRef.current = d.token;
        admin401Redirecting = false;
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = localStorage.getItem(TOKEN_KEY);
      const rt = localStorage.getItem(REFRESH_KEY);
      if (t && !isJwtExpired(t)) {
        tokenRef.current = t;
        if (!cancelled) setSessionReady(true);
        return;
      }
      if (rt && !isJwtExpired(rt)) {
        const ok = await tryRefresh();
        if (!cancelled && ok) {
          setSessionReady(true);
          return;
        }
        if (!cancelled && t && isJwtExpired(t)) {
          logout();
        }
      }
      if (t && isJwtExpired(t) && !rt) {
        logout();
      }
      if (!cancelled) setSessionReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [tryRefresh, logout]);

  useEffect(() => {
    if (!sessionReady || !tokenRef.current) return;
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    })
      .then((r) => (r.ok ? r.json() : { permissions: [] }))
      .then((d) => setPermissions(Array.isArray(d.permissions) ? d.permissions : []))
      .catch(() => setPermissions([]));
  }, [sessionReady, token]);

  const login = async (username, password, mfaCode = null) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, mfa_code: mfaCode || undefined }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const e = new Error(err.error || 'Login failed');
      e.mfaRequired = !!err.mfa_required;
      throw e;
    }
    const data = await res.json();
    admin401Redirecting = false;
    localStorage.setItem(TOKEN_KEY, data.token);
    if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
    else localStorage.removeItem(REFRESH_KEY);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    tokenRef.current = data.token;
    setSessionReady(true);
    return data;
  };

  const hasPermission = useCallback(
    (perm) => {
      if (!perm) return true;
      return permissions.includes('*') || permissions.includes(perm);
    },
    [permissions]
  );

  const api = useCallback(
    async (path, options = {}) => {
      const silent = !!options.silent;
      const maxRetries = options.retries != null ? options.retries : 1;
      const method = String(options.method || 'GET').toUpperCase();
      const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

      const buildHeaders = () => {
        const headers = {
          Authorization: `Bearer ${tokenRef.current}`,
          'Content-Type': 'application/json',
          ...options.headers,
        };
        if (user?.role === 'super_admin' && selectedTenantId != null) {
          headers['X-Tenant-Id'] = String(selectedTenantId);
        }
        return headers;
      };

      const doFetch = () => fetch(path, { ...options, headers: buildHeaders() });

      let attempt = 0;
      while (true) {
        try {
          let res = await doFetch();

          if (res.status === 401 && /\/api\/admin\b/.test(path) && !admin401Redirecting) {
            const refreshed = await tryRefresh();
            if (refreshed) {
              res = await doFetch();
            } else {
              admin401Redirecting = true;
              logout();
              if (window.location.pathname !== '/login') {
                window.location.replace('/login');
              }
              return res;
            }
          }

          if (res.status === 403 && mutating && /\/api\/admin\b/.test(path) && !silent) {
            addToast({ variant: 'error', message: 'Permission denied for this action.' });
          }

          if (res.status >= 500 && res.status < 600 && attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
            attempt += 1;
            continue;
          }

          return res;
        } catch (err) {
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
            attempt += 1;
            continue;
          }
          addToast({
            variant: 'error',
            message: err?.message || 'Network error — check connectivity and try again.',
          });
          throw err;
        }
      }
    },
    [user?.role, selectedTenantId, logout, addToast, tryRefresh]
  );

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        permissions,
        hasPermission,
        sessionReady,
        login,
        logout,
        api,
        selectedTenantId,
        setSelectedTenantId,
        tryRefresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
