import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import PageShell from '../components/PageShell';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  ArcElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import styles from './AnalyticsDetections.module.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, ArcElement, PointElement, Title, Tooltip, Legend);

export default function AnalyticsDetections() {
  const { api } = useAuth();
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [qualityData, setQualityData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setErr('');
    Promise.all([
      api('/api/admin/analytics/detections-summary').then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body;
      }),
      api('/api/admin/analytics/detection-quality').then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body;
      }),
    ])
      .then(([summary, quality]) => {
        setData(summary);
        setQualityData(quality);
      })
      .catch((e) => {
        setData(null);
        setQualityData(null);
        setErr(e.message || 'Failed to load analytics');
      })
      .finally(() => setLoading(false));
  }, [api]);

  const chartData = data?.by_severity?.length
    ? {
        labels: data.by_severity.map((r) => r.severity || 'unknown'),
        datasets: [
          {
            label: 'Alerts',
            data: data.by_severity.map((r) => Number(r.c)),
            backgroundColor: [
              'rgba(239, 68, 68, 0.65)',
              'rgba(249, 115, 22, 0.65)',
              'rgba(234, 179, 8, 0.65)',
              'rgba(34, 197, 94, 0.55)',
            ],
          },
        ],
      }
    : null;

  const trendData = data?.trend_7d?.length
    ? {
        labels: data.trend_7d.map((r) => String(r.day).slice(0, 10)),
        datasets: [
          {
            label: 'Detections',
            data: data.trend_7d.map((r) => Number(r.c || 0)),
            borderColor: 'rgba(56, 189, 248, 0.92)',
            backgroundColor: 'rgba(56, 189, 248, 0.2)',
            fill: true,
            tension: 0.25,
          },
        ],
      }
    : null;

  const statusData = data?.by_status?.length
    ? {
        labels: data.by_status.map((r) => r.status || 'unknown'),
        datasets: [
          {
            label: 'Status',
            data: data.by_status.map((r) => Number(r.c || 0)),
            backgroundColor: [
              'rgba(59, 130, 246, 0.65)',
              'rgba(16, 185, 129, 0.65)',
              'rgba(249, 115, 22, 0.65)',
              'rgba(148, 163, 184, 0.65)',
            ],
          },
        ],
      }
    : null;

  const chartOptions = useMemo(() => {
    const tick = theme === 'light' ? '#475569' : '#94a3b8';
    const grid = theme === 'light' ? 'rgba(15, 23, 42, 0.08)' : 'rgba(240, 246, 252, 0.08)';
    return {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: tick },
          grid: { color: grid },
        },
        y: {
          beginAtZero: true,
          ticks: { color: tick },
          grid: { color: grid },
        },
      },
    };
  }, [theme]);

  return (
    <PageShell
      kicker="Analytics"
      title="Detection analytics"
      description="Heuristic risk and severity mix — not CrowdStrike cloud ML."
    >
      {data?.disclaimer && <p className={styles.disclaimer}>{data.disclaimer}</p>}
      {err ? <p className={styles.err}>Failed: {err}</p> : null}

      <div className={styles.kpis}>
        <div className={styles.kpi}><span>Total detections</span><strong>{data?.kpis?.total_alerts ?? '-'}</strong></div>
        <div className={styles.kpi}><span>Affected hosts</span><strong>{data?.kpis?.affected_hosts ?? '-'}</strong></div>
        <div className={styles.kpi}><span>Avg risk</span><strong>{data?.kpis?.avg_risk ?? '-'}</strong></div>
        <div className={styles.kpi}><span>High + critical</span><strong>{data?.kpis?.high_or_critical ?? '-'}</strong></div>
      </div>

      <h2 className={styles.h2}>Detection quality scorecard</h2>
      <div className={styles.kpis}>
        <div className={styles.kpi}><span>Feedback events</span><strong>{qualityData?.kpis?.total_feedback ?? '-'}</strong></div>
        <div className={styles.kpi}><span>True positive</span><strong>{qualityData?.kpis?.true_positive ?? '-'}</strong></div>
        <div className={styles.kpi}><span>False positive</span><strong>{qualityData?.kpis?.false_positive ?? '-'}</strong></div>
        <div className={styles.kpi}>
          <span>Avg analyst confidence</span>
          <strong>{qualityData?.kpis?.avg_analyst_confidence != null ? `${Math.round(Number(qualityData.kpis.avg_analyst_confidence) * 100)}%` : '-'}</strong>
        </div>
      </div>
      <div className={styles.queueShortcuts}>
        <Link to="/alerts?status_group=active" className={styles.queueLink}>Open active triage queue</Link>
        <Link to="/alerts?status_group=active&assigned_state=unassigned" className={styles.queueLink}>Open unassigned active queue</Link>
        <Link to="/alerts?status_group=closed_only&status=false_positive" className={styles.queueLink}>Open noisy/false-positive queue</Link>
      </div>

      <div className={styles.grid}>
        <div className={styles.chartBox}>
          <h3 className={styles.h3}>Noisy rules (highest false-positive rate)</h3>
          <div className={styles.mitreList}>
            {(qualityData?.noisy_rules || []).map((r) => (
              <div key={`noisy-${r.rule_id}`} className={styles.mitreRow}>
                <div className={styles.ruleCell}>
                  <span className="mono">{r.rule_name}</span>
                  <div className={styles.ruleActions}>
                    <Link to={`/alerts?rule_id=${encodeURIComponent(r.rule_id)}`} className={styles.ruleLink}>View alerts</Link>
                    <Link to={`/alerts?rule_id=${encodeURIComponent(r.rule_id)}&status=false_positive`} className={styles.ruleLink}>False positives</Link>
                    <Link to={`/detection-rules/${r.rule_id}`} className={styles.ruleLink}>Rule</Link>
                  </div>
                </div>
                <strong>{Math.round(Number(r.fp_rate || 0) * 100)}% FP</strong>
              </div>
            ))}
            {(qualityData?.noisy_rules || []).length === 0 && <p className={styles.muted}>No quality feedback yet.</p>}
          </div>
        </div>

        <div className={styles.chartBox}>
          <h3 className={styles.h3}>High-signal rules (highest true-positive rate)</h3>
          <div className={styles.mitreList}>
            {(qualityData?.high_signal_rules || []).map((r) => (
              <div key={`signal-${r.rule_id}`} className={styles.mitreRow}>
                <div className={styles.ruleCell}>
                  <span className="mono">{r.rule_name}</span>
                  <div className={styles.ruleActions}>
                    <Link to={`/alerts?rule_id=${encodeURIComponent(r.rule_id)}`} className={styles.ruleLink}>View alerts</Link>
                    <Link to={`/alerts?rule_id=${encodeURIComponent(r.rule_id)}&status_group=active`} className={styles.ruleLink}>Active triage</Link>
                    <Link to={`/alerts?rule_id=${encodeURIComponent(r.rule_id)}&status=investigating`} className={styles.ruleLink}>Investigating</Link>
                    <Link to={`/alerts?rule_id=${encodeURIComponent(r.rule_id)}&status=new`} className={styles.ruleLink}>New TPs</Link>
                    <Link to={`/detection-rules/${r.rule_id}`} className={styles.ruleLink}>Rule</Link>
                  </div>
                </div>
                <strong>{Math.round(Number(r.tp_rate || 0) * 100)}% TP</strong>
              </div>
            ))}
            {(qualityData?.high_signal_rules || []).length === 0 && <p className={styles.muted}>No quality feedback yet.</p>}
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {chartData && (
          <div className={styles.chartBox}>
            <h3 className={styles.h3}>Severity distribution</h3>
            <Bar key={`sev-${theme}`} data={chartData} options={chartOptions} />
          </div>
        )}
        {trendData && (
          <div className={styles.chartBox}>
            <h3 className={styles.h3}>7-day detection trend</h3>
            <Line key={`trend-${theme}`} data={trendData} options={chartOptions} />
          </div>
        )}
        {statusData && (
          <div className={styles.chartBox}>
            <h3 className={styles.h3}>Status coverage</h3>
            <Doughnut
              key={`status-${theme}`}
              data={statusData}
              options={{
                responsive: true,
                plugins: { legend: { labels: { color: theme === 'light' ? '#334155' : '#94a3b8' } } },
              }}
            />
          </div>
        )}
        {(data?.top_mitre || []).length > 0 && (
          <div className={styles.chartBox}>
            <h3 className={styles.h3}>Top MITRE techniques</h3>
            <div className={styles.mitreList}>
              {data.top_mitre.map((r) => (
                <div key={r.technique} className={styles.mitreRow}>
                  <span className="mono">{r.technique}</span>
                  <strong>{r.c}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <h2 className={styles.h2}>Recent detections (narrative)</h2>
      <div className={styles.list}>
        {(data?.recent_detections || []).map((d) => (
          <div key={d.id} className={styles.card}>
            <div className={styles.row}>
              <Link to={`/alerts/${d.id}`} className={styles.title}>
                {d.title}
              </Link>
              <span className="mono">{d.hostname}</span>
            </div>
            <div className={styles.meta}>
              <span>Risk {Math.round(Number(d.risk_score) || 0)}</span>
              <span>{d.severity}</span>
              <span>{d.mitre_technique || 'unmapped'}</span>
            </div>
            <p className={styles.narrative}>{d.narrative}</p>
          </div>
        ))}
      </div>
      {loading && <p className={styles.muted}>Loading analytics…</p>}
      {!loading && !data && !err && <p className={styles.muted}>No analytics data available yet.</p>}
    </PageShell>
  );
}
