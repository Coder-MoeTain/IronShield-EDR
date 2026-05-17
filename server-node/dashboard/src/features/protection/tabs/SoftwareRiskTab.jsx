import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import PageShell from '../../../components/PageShell';
import DetailDrawer from '../../../components/DetailDrawer';
import { apiPath } from '../../../utils/apiPath';
import { readApiJson } from '../../../utils/apiEnvelope';
import {
  NotifyUpdateModal,
  NotifyUninstallModal,
  BlockModal,
  AcceptRiskModal,
  ModalShell,
} from '../../../components/software/SoftwareActionModals';
import styles from './SoftwareRiskTab.module.css';

const SUB_TABS = [
  { id: 'summary', label: 'Risk Summary' },
  { id: 'inventory', label: 'Installed Software' },
  { id: 'vulnerable', label: 'Vulnerable Software' },
  { id: 'policies', label: 'Block Policies' },
  { id: 'remediation', label: 'Remediation Actions' },
  { id: 'reports', label: 'Reports' },
  { id: 'vulndb', label: 'Vulnerability Database' },
];

const REPORT_TYPES = [
  { id: 'vulnerable', label: 'Vulnerable Software' },
  { id: 'critical-risk', label: 'Critical Software Risk' },
  { id: 'endpoint-inventory', label: 'Endpoint Inventory' },
  { id: 'blocked', label: 'Blocked Software' },
  { id: 'remediation-status', label: 'Remediation Status' },
  { id: 'accepted-risk', label: 'Accepted Risk' },
];

function riskTags(row) {
  const tags = [];
  if (row.risk_level === 'critical') tags.push({ label: 'Critical CVE', tone: 'bad' });
  else if (row.risk_level === 'high') tags.push({ label: 'High CVE', tone: 'warn' });
  if (row.known_exploit_count > 0) tags.push({ label: 'Known Exploited', tone: 'bad' });
  if (row.outdated) tags.push({ label: 'Outdated', tone: 'warn' });
  if (row.unsupported) tags.push({ label: 'Unsupported', tone: 'warn' });
  if (row.blocked) tags.push({ label: 'Blocked', tone: 'bad' });
  if (row.accepted_risk) tags.push({ label: 'Accepted Risk', tone: 'muted' });
  if (row.recommended_action === 'update') tags.push({ label: 'Update Required', tone: 'warn' });
  if (row.recommended_action === 'uninstall') tags.push({ label: 'Uninstall Required', tone: 'bad' });
  if (row.needs_review) tags.push({ label: 'Needs Review', tone: 'warn' });
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
  const [selectedCve, setSelectedCve] = useState(null);
  const [actionMsg, setActionMsg] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [reportType, setReportType] = useState('vulnerable');
  const [reportFormat, setReportFormat] = useState('json');

  const fetchJson = useCallback(
    async (path) => {
      const res = await api(apiPath(path));
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const { data } = await readApiJson(res);
      return data;
    },
    [api]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filters.risk_level) q.set('risk_level', filters.risk_level);
      if (filters.vendor) q.set('vendor', filters.vendor);
      if (filters.software_name) q.set('software_name', filters.software_name);
      if (subTab === 'vulnerable') q.set('risk_score_min', '61');

      const [sum, inv, pol, rem, vuln] = await Promise.all([
        fetchJson('/api/software/summary'),
        fetchJson(`/api/software/inventory?${q}&limit=200`),
        subTab === 'policies' ? fetchJson('/api/software/block-policies') : null,
        subTab === 'remediation' || selected ? fetchJson('/api/software/remediation-actions?limit=100') : null,
        subTab === 'vulndb' ? fetchJson('/api/software/vulnerabilities?limit=100') : null,
      ]);

      setSummary(sum);
      setInventory(inv?.inventory || []);
      if (pol) setPolicies(pol.policies || []);
      if (rem) setRemediation(rem.rows || []);
      if (vuln) setVulns(vuln.rows || []);
    } catch {
      setSummary(null);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, [fetchJson, filters, subTab, selected]);

  useEffect(() => {
    load();
  }, [load]);

  const postAction = async (id, action, body = {}) => {
    setActionMsg('');
    try {
      const res = await api(apiPath(`/api/software/inventory/${id}/${action}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Action failed (${res.status})`);
      }
      setActionMsg(`${action} completed`);
      setModal(null);
      load();
    } catch (e) {
      setActionMsg(e.message);
    }
  };

  const exportReport = async () => {
    const url = apiPath(`/api/software/reports/${reportType}?format=${reportFormat}`);
    if (reportFormat === 'json') {
      const data = await fetchJson(url);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `software-${reportType}.json`;
      a.click();
    } else {
      window.open(url, '_blank');
    }
  };

  const timelineFor = (inventoryId) =>
    remediation.filter((r) => String(r.software_inventory_id) === String(inventoryId));

  return (
    <PageShell
      title="Software Risk Management"
      description="Installed software inventory, vulnerability scoring, remediation, and execution block policies."
    >
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
          <input
            placeholder="Software name"
            value={filters.software_name}
            onChange={(e) => setFilters({ ...filters, software_name: e.target.value })}
          />
          <input
            placeholder="Vendor"
            value={filters.vendor}
            onChange={(e) => setFilters({ ...filters, vendor: e.target.value })}
          />
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

      {subTab === 'reports' && (
        <div className={styles.reportPanel}>
          <label>
            Report
            <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
              {REPORT_TYPES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </label>
          <label>
            Format
            <select value={reportFormat} onChange={(e) => setReportFormat(e.target.value)}>
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="html">HTML</option>
            </select>
          </label>
          <button type="button" className={styles.primaryBtn} onClick={exportReport}>Export report</button>
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
                  <th>Explanation</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.vendor || '—'}</td>
                    <td>{row.version || '—'}</td>
                    <td>
                      <Link to={`/endpoints/${row.endpoint_id}?tab=software`}>{row.hostname || row.endpoint_id}</Link>
                    </td>
                    <td><span className={styles[`risk_${row.risk_level}`]}>{row.risk_score ?? 0}</span></td>
                    <td className={styles.tags}>
                      {riskTags(row).map((t) => (
                        <span key={t.label} className={styles[`tag_${t.tone}`]}>{t.label}</span>
                      ))}
                    </td>
                    <td className={styles.reasonCell}>{row.reason || row.recommended_action || '—'}</td>
                    <td className={styles.actions}>
                      <button type="button" onClick={() => setSelected(row)}>Detail</button>
                      <button type="button" onClick={() => { setSelected(row); setModal('notify-update'); setForm({}); }}>Update</button>
                      <button type="button" onClick={() => { setSelected(row); setModal('notify-uninstall'); setForm({}); }}>Uninstall</button>
                      <button type="button" onClick={() => { setSelected(row); setModal('block'); setForm({}); }}>Block</button>
                      <button type="button" onClick={() => { setSelected(row); setModal('accept-risk'); setForm({}); }}>Accept</button>
                      <button type="button" onClick={() => postAction(row.id, 'refresh')}>Refresh</button>
                      <button type="button" onClick={() => postAction(row.id, 'create-incident')}>Incident</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {subTab === 'policies' && (
        <div>
          <div className={styles.filters}>
            <button type="button" className={styles.primaryBtn} onClick={() => { setModal('block-policy'); setForm({}); }}>
              Create block policy
            </button>
            <button type="button" onClick={() => { setModal('emergency-unblock'); setForm({}); }}>
              Emergency unblock all
            </button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr><th>Name</th><th>Software</th><th>Action</th><th>Lifecycle</th><th>Enabled</th><th /></tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.software_name}</td>
                  <td>{p.action}</td>
                  <td>{p.lifecycle_status || 'active'}</td>
                  <td>{p.enabled ? 'Yes' : 'No'}</td>
                  <td>
                    {p.lifecycle_status === 'pending_approval' && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await api(apiPath(`/api/software/block-policies/${p.id}/approve`), { method: 'POST' });
                            if (!res.ok) throw new Error('Approve failed');
                            setActionMsg('Policy approved');
                            load();
                          } catch (e) {
                            setActionMsg(e.message);
                          }
                        }}
                      >
                        Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'remediation' && (
        <table className={styles.table}>
          <thead><tr><th>Software</th><th>Endpoint</th><th>Action</th><th>Status</th><th>By</th><th>When</th></tr></thead>
          <tbody>
            {remediation.map((r) => (
              <tr key={r.id}>
                <td>{r.software_name}</td>
                <td>{r.hostname}</td>
                <td>{r.action_type}</td>
                <td>{r.status}</td>
                <td>{r.requested_by}</td>
                <td>{r.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {subTab === 'vulndb' && (
        <div>
          <div className={styles.filters}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => { setModal('vuln-import'); setForm({ json: '' }); }}
            >
              Import vulnerabilities (JSON)
            </button>
          </div>
        <table className={styles.table}>
          <thead><tr><th>CVE</th><th>Software</th><th>Severity</th><th>Expression</th><th>Fixed</th><th /></tr></thead>
          <tbody>
            {vulns.map((v) => (
              <tr key={v.id}>
                <td>{v.cve_id}</td>
                <td>{v.normalized_name}</td>
                <td>{v.severity}</td>
                <td>{v.affected_version_expression}</td>
                <td>{v.fixed_version}</td>
                <td><button type="button" onClick={() => setSelectedCve(v)}>CVE detail</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <DetailDrawer open={!!selected} title={selected?.name} onClose={() => setSelected(null)}>
        {selected && (
          <div>
            <p><strong>Vendor:</strong> {selected.vendor} · <strong>Version:</strong> {selected.version}</p>
            <p><strong>Risk:</strong> {selected.risk_score}/100 ({selected.risk_level})</p>
            <p className={styles.riskExplanation}>{selected.reason || 'No risk factors recorded.'}</p>
            {selected.risk_factors && (
              <pre className={styles.factorsPre}>{JSON.stringify(selected.risk_factors, null, 2)}</pre>
            )}
            <h4>Remediation timeline</h4>
            <ul className={styles.timeline}>
              {timelineFor(selected.id).length === 0 && <li>No remediation actions yet.</li>}
              {timelineFor(selected.id).map((a) => (
                <li key={a.id}>{a.created_at}: {a.action_type} — {a.status} ({a.requested_by})</li>
              ))}
            </ul>
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer open={!!selectedCve} title={selectedCve?.cve_id} onClose={() => setSelectedCve(null)}>
        {selectedCve && (
          <div>
            <p>{selectedCve.cve_title}</p>
            <p><strong>Severity:</strong> {selectedCve.severity} · CVSS {selectedCve.cvss_score}</p>
            <p><strong>Affected:</strong> {selectedCve.affected_version_expression}</p>
            <p><strong>Fixed in:</strong> {selectedCve.fixed_version || '—'}</p>
            <p>{selectedCve.description}</p>
            {selectedCve.needs_review ? <p className={styles.warnTag}>Needs version review</p> : null}
          </div>
        )}
      </DetailDrawer>

      <NotifyUpdateModal
        open={modal === 'notify-update' && !!selected}
        selected={selected}
        form={form}
        setForm={setForm}
        onClose={() => setModal(null)}
        onSubmit={() => postAction(selected.id, 'notify-update', { title: form.title, message: form.message })}
      />
      <NotifyUninstallModal
        open={modal === 'notify-uninstall' && !!selected}
        selected={selected}
        form={form}
        setForm={setForm}
        onClose={() => setModal(null)}
        onSubmit={() => postAction(selected.id, 'notify-uninstall', { title: form.title, message: form.message })}
      />
      <BlockModal
        open={modal === 'block' && !!selected}
        selected={selected}
        form={form}
        setForm={setForm}
        onClose={() => setModal(null)}
        onSubmit={() =>
          postAction(selected.id, 'block', {
            reason: form.reason,
            approved_by: form.approved_by || undefined,
            expires_at: form.expires_at || undefined,
          })
        }
      />
      <AcceptRiskModal
        open={modal === 'accept-risk' && !!selected}
        selected={selected}
        form={form}
        setForm={setForm}
        onClose={() => setModal(null)}
        onSubmit={() => postAction(selected.id, 'accept-risk', { reason: form.reason, until: form.until })}
      />

      <ModalShell
        open={modal === 'block-policy'}
        title="Create block policy"
        onClose={() => setModal(null)}
        onSubmit={async () => {
          try {
            const res = await api(apiPath('/api/software/block-policies'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...form, block_reason: form.block_reason || form.reason }),
            });
            if (!res.ok) throw new Error('Failed');
            setModal(null);
            load();
          } catch (e) {
            setActionMsg(e.message);
          }
        }}
        submitLabel="Create policy"
      >
        <input placeholder="Policy name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Software name" value={form.software_name || ''} onChange={(e) => setForm({ ...form, software_name: e.target.value })} />
        <input placeholder="Version expression" value={form.version_expression || ''} onChange={(e) => setForm({ ...form, version_expression: e.target.value })} />
        <textarea placeholder="Block reason" value={form.block_reason || ''} onChange={(e) => setForm({ ...form, block_reason: e.target.value })} rows={2} />
      </ModalShell>

      <ModalShell
        open={modal === 'emergency-unblock'}
        title="Emergency unblock all software"
        onClose={() => setModal(null)}
        onSubmit={async () => {
          try {
            const res = await api(apiPath('/api/software/emergency-unblock'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason: form.reason }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err?.error?.message || 'Emergency unblock failed');
            }
            setModal(null);
            setActionMsg('Emergency unblock completed');
            load();
          } catch (e) {
            setActionMsg(e.message);
          }
        }}
        submitLabel="Unblock all"
      >
        <textarea
          placeholder="Reason (required, min 5 chars)"
          value={form.reason || ''}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          rows={3}
        />
      </ModalShell>

      <ModalShell
        open={modal === 'vuln-import'}
        title="Import vulnerabilities"
        onClose={() => setModal(null)}
        onSubmit={async () => {
          try {
            const records = JSON.parse(form.json || '[]');
            const res = await api(apiPath('/api/software/vulnerabilities/import'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ records }),
            });
            if (!res.ok) throw new Error('Import failed');
            const { data } = await readApiJson(res);
            setActionMsg(`Imported ${data?.imported ?? 0}, skipped ${data?.skipped ?? 0}`);
            setModal(null);
            load();
          } catch (e) {
            setActionMsg(e.message);
          }
        }}
        submitLabel="Import"
      >
        <textarea
          placeholder='[{"cve_id":"CVE-DEMO-0001","normalized_name":"chrome",...}]'
          value={form.json || ''}
          onChange={(e) => setForm({ ...form, json: e.target.value })}
          rows={8}
        />
      </ModalShell>
    </PageShell>
  );
}

