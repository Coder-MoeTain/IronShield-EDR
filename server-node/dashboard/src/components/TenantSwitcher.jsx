import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './TenantSwitcher.module.css';

export default function TenantSwitcher() {
  const { api, user, selectedTenantId, setSelectedTenantId } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api('/api/admin/tenants')
      .then((r) => r.json())
      .then(setTenants)
      .catch(() => setTenants([]));
  }, [api]);

  const isSuperAdmin = user?.role === 'super_admin';
  const currentLabel = selectedTenantId
    ? tenants.find((t) => t.id === selectedTenantId)?.name || `Tenant ${selectedTenantId}`
    : 'All Tenants';

  if (!isSuperAdmin) {
    const t = tenants.find((x) => x.id === user?.tenantId) || tenants[0];
    return (
      <div className={styles.tenantBadge} title="Current tenant">
        {t?.name || 'Tenant'}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        title="Switch tenant context"
      >
        <span className={styles.triggerIcon}>🏢</span>
        <span className={styles.triggerLabel}>{currentLabel}</span>
        <span className={styles.triggerChevron}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.dropdown}>
            <button
              type="button"
              className={`${styles.option} ${!selectedTenantId ? styles.optionActive : ''}`}
              onClick={() => {
                setSelectedTenantId(null);
                setOpen(false);
              }}
            >
              All Tenants
            </button>
            {tenants.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${styles.option} ${selectedTenantId === t.id ? styles.optionActive : ''}`}
                onClick={() => {
                  setSelectedTenantId(t.id);
                  setOpen(false);
                }}
              >
                {t.name}
                {t.endpoint_count != null && (
                  <span className={styles.optionCount}>({t.endpoint_count})</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
