import React from 'react';
import styles from './ReportSearch.module.css';

export default function ReportSearch({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className={styles.searchWrap}>
      <span className={styles.searchIcon}>🔍</span>
      <input
        type="search"
        className={styles.searchInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
      />
      {value && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
