import React from 'react';
import { Link } from 'react-router-dom';
import styles from './RouteErrorBoundary.module.css';

/**
 * Catches render errors outside the per-route boundary (providers, login, or shell).
 */
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('App error boundary', error, info);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className={styles.wrap} role="alert">
          <h1 className={styles.title}>Application error</h1>
          <p className={styles.desc}>
            The console hit an unexpected error. Reload the page or return to sign-in. If this persists, check the browser
            console for details.
          </p>
          <div className={styles.actions}>
            <button type="button" className="falcon-btn falcon-btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <Link to="/login" className="falcon-btn falcon-btn-ghost">
              Sign in
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
