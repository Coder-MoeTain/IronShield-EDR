import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import AppErrorBoundary from './components/AppErrorBoundary';
import { EvidenceDrawerProvider } from './context/EvidenceDrawerContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import { isJwtExpired } from './utils/jwt';
import { getAllLayoutRoutes } from './routes/routeMap.jsx';

function RouteFallback() {
  return (
    <div className="ui-route-fallback" role="status" aria-live="polite" aria-label="Loading view">
      Loading…
    </div>
  );
}

function PrivateRoute({ children }) {
  const { token, logout, sessionReady } = useAuth();
  useEffect(() => {
    if (token && isJwtExpired(token)) logout();
  }, [token, logout]);
  if (!sessionReady) {
    return (
      <div className="ui-loading" role="status" style={{ padding: '2rem', textAlign: 'center' }}>
        Loading session…
      </div>
    );
  }
  if (!token || isJwtExpired(token)) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const layoutRoutes = getAllLayoutRoutes();

  return (
    <AppErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <EvidenceDrawerProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/"
                  element={
                    <PrivateRoute>
                      <Layout />
                    </PrivateRoute>
                  }
                >
                  {layoutRoutes.map((r) =>
                    r.index ? (
                      <Route key="index" index element={r.element} />
                    ) : (
                      <Route key={r.path} path={r.path} element={r.element} />
                    )
                  )}
                </Route>
              </Routes>
            </Suspense>
            </EvidenceDrawerProvider>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </AppErrorBoundary>
  );
}
