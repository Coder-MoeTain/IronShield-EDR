import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { IconShield } from '../components/NavIcons';
import styles from './Login.module.css';

export default function Login() {
  const oidcSsoEnabled = import.meta.env.VITE_ENABLE_OIDC_SSO === 'true';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password, needsMfa ? mfaCode : null);
      navigate('/');
    } catch (err) {
      if (err.mfaRequired) {
        setNeedsMfa(true);
        setError('MFA required. Enter your 6-digit authenticator code.');
      } else if (/MFA enrollment required/i.test(err.message || '')) {
        setError('Organization policy requires MFA enrollment. Sign in, then enable MFA in Enterprise > Account Security.');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.themeToggle}>
        <ThemeToggle />
      </div>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.brandMark} aria-hidden>
            <IconShield />
          </div>
          <h1>IronShield</h1>
          <p>Sign in to the EDR console</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {needsMfa && (
            <input
              type="text"
              placeholder="Authenticator code (6 digits)"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              required
              inputMode="numeric"
              pattern="\d{6}"
            />
          )}
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          {oidcSsoEnabled && (
            <a href="/api/auth/sso/oidc/start" className={styles.ssoBtn}>
              Sign in with SSO (OIDC)
            </a>
          )}
        </form>
        <p className={styles.hint}>Use enterprise credentials. MFA code is required if enabled on your account.</p>
      </div>
    </div>
  );
}
