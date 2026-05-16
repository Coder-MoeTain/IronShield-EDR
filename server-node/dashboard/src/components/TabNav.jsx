import React from 'react';

/**
 * Segmented tab navigation synced with URL ?tab= via parent.
 */
export default function TabNav({ tabs, activeTab, onChange, ariaLabel = 'Sections' }) {
  if (!tabs?.length) return null;
  return (
    <div className="ui-segmented console-tab-nav" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={activeTab === t.id}
          onClick={() => onChange(t.id)}
          disabled={t.disabled}
          title={t.title}
        >
          {t.label}
          {t.badge != null ? <span className="console-tab-badge">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
