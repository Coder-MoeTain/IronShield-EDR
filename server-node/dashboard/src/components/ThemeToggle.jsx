import React from 'react';
import { useTheme } from '../context/ThemeContext';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextMode = theme === 'light' ? 'dark' : 'light';
  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleTheme}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? (
        <span className={styles.icon} aria-hidden>
          🌙
        </span>
      ) : (
        <span className={styles.icon} aria-hidden>
          ☀️
        </span>
      )}
      <span className={styles.text}>
        <span className={styles.label}>Appearance</span>
        <span className={styles.value}>{theme === 'light' ? 'Light' : 'Dark'}</span>
        <span className={styles.action}>Use {nextMode}</span>
      </span>
    </button>
  );
}
