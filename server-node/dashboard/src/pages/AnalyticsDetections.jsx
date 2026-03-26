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
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import styles from './AnalyticsDetections.module.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AnalyticsDetections() {
  const { api } = useAuth();
  const { theme } = useTheme();
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/api/admin/analytics/detections-summary')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
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

      {chartData && (
        <div className={styles.chartBox}>
          <Bar key={theme} data={chartData} options={chartOptions} />
        </div>
      )}

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
            </div>
            <p className={styles.narrative}>{d.narrative}</p>
          </div>
        ))}
      </div>
      {!data && <p className={styles.muted}>Loading…</p>}
    </PageShell>
  );
}
