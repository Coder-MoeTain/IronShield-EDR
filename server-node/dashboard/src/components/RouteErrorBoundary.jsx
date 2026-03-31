import React from 'react';
import { Link } from 'react-router-dom';
import styles from './RouteErrorBoundary.module.css';

export class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('Route render error', error, info);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className={styles.wrap} role="alert">
          <h1 className={styles.title}>Something went wrong</h1>
          <p className={styles.desc}>
            This view hit an unexpected error. You can go back to the dashboard or reload the page. If this keeps happening,
            check the browser console for details.
          </p>
          <div className={styles.actions}>
            <button type="button" className="falcon-btn falcon-btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <Link to="/" className="falcon-btn falcon-btn-ghost">
              Dashboard
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
