import React from 'react';

export default function KpiStrip({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="console-kpi-strip" role="group" aria-label="Key metrics">
      {items.map((item) => (
        <div key={item.id || item.label} className="console-kpi">
          <span className="console-kpi-label">{item.label}</span>
          <span className={`console-kpi-value ${item.tone ? `console-kpi-${item.tone}` : ''}`}>
            {item.value ?? '—'}
          </span>
          {item.hint ? <span className="console-kpi-hint">{item.hint}</span> : null}
        </div>
      ))}
    </div>
  );
}
