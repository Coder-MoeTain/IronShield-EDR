import React from 'react';
import { useTheme } from '../context/ThemeContext';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleTheme}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? (
        <span className={styles.icon} aria-hidden>🌙</span>
      ) : (
        <span className={styles.icon} aria-hidden>☀️</span>
      )}
    </button>
  );
}
