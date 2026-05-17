import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import PageShell from '../../../components/PageShell';
import { apiPath } from '../../../utils/apiPath';
import styles from './SoftwareRiskTab.module.css';

const SUB_TABS = [
  { id: 'summary', label: 'Risk Summary' },
  { id: 'inventory', label: 'Installed Software' },
  { id: 'vulnerable', label: 'Vulnerable Software' },
  { id: 'policies', label: 'Block Policies' },
  { id: 'remediation', label: 'Remediation Actions' },
  { id: 'vulndb', label: 'Vulnerability Database' },
];

function riskTags(row) {
  const tags = [];
  if (row.risk_level === 'critical') tags.push({ label: 'Critical CVE', tone: 'bad' });
  else if (row.risk_level === 'high') tags.push({ label: 'High Risk', tone: 'warn' });
  if (row.known_exploit_count > 0) tags.push({ label: 'Known Exploited', tone: 'bad' });
  if (row.outdated) tags.push({ label: 'Outdated', tone: 'warn' });
  if (row.blocked) tags.push({ label: 'Blocked', tone: 'bad' });
  if (row.accepted_risk) tags.push({ label: 'Accepted Risk', tone: 'muted' });
  if (row.recommended_action === 'update') tags.push({ label: 'Update Required', tone: 'warn' });
  if (!tags.length && (row.risk_score || 0) === 0) tags.push({ label: 'No Known Risk', tone: 'ok' });
  return tags;
}

export default function SoftwareRiskTab() {
  const { api } = useAuth();
  const [subTab, setSubTab] = useState('summary');
  const [summary, setSummary] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [remediation, setRemediation] = useState([]);
  const [vulns, setVulns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ risk_level: '', vendor: '', software_name: '' });
  const [selected, setSelected] = useState(null);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filters.risk_level) q.set('risk_level', filters.risk_level);
      if (filters.vendor) q.set('vendor', filters.vendor);
      if (filters.software_name) q.set('software_name', filters.software_name);
      if (subTab === 'vulnerable') q.set('risk_score_min', '61');

      const [sumRes, invRes, polRes, remRes, vulnRes] = await Promise.all([
        api(apiPath('/api/software/summary')),
        api(apiPath(`/api/software/inventory?${q}&limit=200`)),
        subTab === 'policies' ? api(apiPath('/api/software/block-policies')) : Promise.resolve(null),
        subTab === 'remediation' ? api(apiPath('/api/software/remediation-actions')) : Promise.resolve(null),
        subTab === 'vulndb' ? api(apiPath('/api/software/vulnerabilities?limit=100')) : Promise.resolve(null),
      ]);

      if (sumRes?.ok) setSummary(await sumRes.json());
      if (invRes?.ok) {
        const d = await invRes.json();
        setInventory(d.inventory || []);
      }
      if (polRes?.ok) {
        const d = await polRes.json();
        setPolicies(d.policies || []);
      }
      if (remRes?.ok) {
        const d = await remRes.json();
        setRemediation(d.rows || []);
      }
      if (vulnRes?.ok) {
        const d = await vulnRes.json();
        setVulns(d.rows || []);
      }
    } catch {
      setSummary(null);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, [api, filters, subTab]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (id, action) => {
    setActionMsg('');
    try {
      const res = await api(apiPath(`/api/software/inventory/${id}/${action}`), { method: 'POST', body: '{}' });
      if (!res.ok) throw new Error(`Action failed (${res.status})`);
      setActionMsg(`${action} sent`);
      load();
    } catch (e) {
      setActionMsg(e.message);
    }
  };

  return (
    <PageShell title="Software Risk Management" description="Installed software inventory, vulnerability scoring, and remediation.">
      <div className={styles.subTabs}>
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={subTab === t.id ? styles.subTabActive : styles.subTab}
            onClick={() => setSubTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(subTab === 'summary' || subTab === 'inventory' || subTab === 'vulnerable') && (
        <div className={styles.filters}>
          <input placeholder="Software name" value={filters.software_name} onChange={(e) => setFilters({ ...filters, software_name: e.target.value })} />
          <input placeholder="Vendor" value={filters.vendor} onChange={(e) => setFilters({ ...filters, vendor: e.target.value })} />
          <select value={filters.risk_level} onChange={(e) => setFilters({ ...filters, risk_level: e.target.value })}>
            <option value="">All risk levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button type="button" onClick={load}>Apply</button>
        </div>
      )}

      {actionMsg && <p className={styles.msg}>{actionMsg}</p>}

      {subTab === 'summary' && summary && (
        <div className={styles.kpiGrid}>
          <div className={styles.kpi}><span>Installed</span><strong>{summary.total_installed ?? 0}</strong></div>
          <div className={styles.kpi}><span>Vulnerable</span><strong>{summary.vulnerable_count ?? 0}</strong></div>
          <div className={styles.kpi}><span>Critical</span><strong>{summary.critical_count ?? 0}</strong></div>
          <div className={styles.kpi}><span>Blocked</span><strong>{summary.blocked_count ?? 0}</strong></div>
          <div className={styles.kpi}><span>Endpoints affected</span><strong>{summary.endpoints_affected ?? 0}</strong></div>
        </div>
      )}

      {(subTab === 'inventory' || subTab === 'vulnerable' || subTab === 'summary') && (
        <div className={styles.tableWrap}>
          {loading ? <p>Loading…</p> : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Software</th>
                  <th>Vendor</th>
                  <th>Version</th>
                  <th>Endpoint</th>
                  <th>Risk</th>
                  <th>Tags</th>
                  <th>Action</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {inventory.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.vendor || '—'}</td>
                    <td>{row.version || '—'}</td>
                    <td><Link to={`/endpoints/${row.endpoint_id}?tab=software`}>{row.hostname || row.endpoint_id}</Link></td>
                    <td><span className={styles[`risk_${row.risk_level}`]}>{row.risk_score ?? 0}</span></td>
                    <td className={styles.tags}>{riskTags(row).map((t) => <span key={t.label} className={styles[`tag_${t.tone}`]}>{t.label}</span>)}</td>
                    <td>{row.recommended_action || '—'}</td>
                    <td className={styles.actions}>
                      <button type="button" onClick={() => setSelected(row)}>Detail</button>
                      <button type="button" onClick={() => runAction(row.id, 'notify-update')}>Notify</button>
                      <button type="button" onClick={() => runAction(row.id, 'block')}>Block</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {subTab === 'policies' && (
        <table className={styles.table}>
          <thead><tr><th>Name</th><th>Software</th><th>Action</th><th>Enabled</th></tr></thead>
          <tbody>{policies.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.software_name}</td><td>{p.action}</td><td>{p.enabled ? 'Yes' : 'No'}</td></tr>)}</tbody>
        </table>
      )}

      {subTab === 'remediation' && (
        <table className={styles.table}>
          <thead><tr><th>Software</th><th>Endpoint</th><th>Action</th><th>Status</th><th>By</th></tr></thead>
          <tbody>{remediation.map((r) => <tr key={r.id}><td>{r.software_name}</td><td>{r.hostname}</td><td>{r.action_type}</td><td>{r.status}</td><td>{r.requested_by}</td></tr>)}</tbody>
        </table>
      )}

      {subTab === 'vulndb' && (
        <table className={styles.table}>
          <thead><tr><th>CVE</th><th>Software</th><th>Severity</th><th>Expression</th><th>Fixed</th></tr></thead>
          <tbody>{vulns.map((v) => <tr key={v.id}><td>{v.cve_id}</td><td>{v.normalized_name}</td><td>{v.severity}</td><td>{v.affected_version_expression}</td><td>{v.fixed_version}</td></tr>)}</tbody>
        </table>
      )}

      {selected && (
        <div className={styles.drawer}>
          <h3>{selected.name}</h3>
          <p>Vendor: {selected.vendor} · Version: {selected.version}</p>
          <p>Risk: {selected.risk_score}/100 ({selected.risk_level})</p>
          <p>{selected.reason}</p>
          <button type="button" onClick={() => setSelected(null)}>Close</button>
        </div>
      )}
    </PageShell>
  );
}
