import React from 'react';

const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export default function MockModeBanner() {
  if (!demoMode) return null;
  return (
    <div
      className="mock-mode-banner"
      role="status"
      style={{
        background: 'var(--accent-amber, #b45309)',
        color: '#fff',
        padding: '0.35rem 1rem',
        fontSize: '0.85rem',
        textAlign: 'center',
      }}
    >
      Demo mode — data may be mocked. Do not use for production SOC decisions.
    </div>
  );
}
