import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiPath } from '../utils/apiPath';
import LoadingState from './LoadingState';

export default function ProductionReadinessPanel({ compact = false }) {
  const { api } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api(apiPath('/api/admin/platform/production-readiness'))
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [api]);

  if (!data) return compact ? null : <LoadingState label="Production readiness" />;

  const score = data.score ?? 0;
  const tone = score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'bad';
  const categories = data.categories || [];
  const fixNext = data.fix_next || [];

  return (
    <section className={`console-readiness console-readiness-${tone}`} aria-label="Production readiness">
      <div className="console-readiness-header">
        <h3>Production readiness</h3>
        <span className={`console-readiness-score console-kpi-${tone}`}>{score}/100</span>
      </div>
      {!compact && fixNext.length > 0 ? (
        <div className="console-readiness-fix-next">
          <h4>Fix next</h4>
          <ol>
            {fixNext.map((f) => (
              <li key={f.id}>
                <strong>{f.label}</strong> ({f.category}): {f.fix}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {!compact && categories.length > 0 ? (
        <div className="console-readiness-categories">
          {categories.map((cat) => (
            <details key={cat.id} className="console-readiness-category">
              <summary>
                {cat.label} — {cat.score}%
              </summary>
              <ul className="console-readiness-checks">
                {(cat.checks || []).map((c) => (
                  <li key={c.id} className={c.ok ? 'ok' : 'fail'} title={c.detail}>
                    <span>{c.ok ? '✓' : '○'}</span> {c.label}
                    {!c.ok && c.missing ? (
                      <span className="console-readiness-missing"> — {c.missing}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      ) : compact ? null : (
        <ul className="console-readiness-checks">
          {(data.checks || []).map((c) => (
            <li key={c.id} className={c.ok ? 'ok' : 'fail'}>
              <span>{c.ok ? '✓' : '○'}</span> {c.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
