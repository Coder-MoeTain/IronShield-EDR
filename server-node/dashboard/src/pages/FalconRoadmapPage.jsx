import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './FalconRoadmapPage.module.css';

const TITLES = {
  identity: 'Identity / Zero Trust',
  exposure: 'Exposure / attack surface',
  'managed-hunting': 'Managed hunting / Overwatch',
  'prevention-deep': 'Deep prevention (exploit, device control, USB)',
  integrations: 'Integrations / XDR fabric',
};

function fmtTime(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

function postureToneClass(band) {
  if (band === 'weak') return 'badgeOff';
  if (band === 'moderate') return '';
  return 'badgeOn';
}

export default function FalconRoadmapPage() {
  const { area } = useParams();
  const { api } = useAuth();
  const [payload, setPayload] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    api(`/api/admin/advanced-modules/${encodeURIComponent(area || '')}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then(setPayload)
      .catch((e) => {
        setPayload(null);
        setErr(e.message || 'Failed to load');
      })
      .finally(() => setLoading(false));
  }, [api, area]);

  useEffect(() => {
    load();
  }, [load]);

  const title = payload?.title || TITLES[area] || 'Advanced module';
  const d = payload?.data;

  return (
    <PageShell
      kicker="Advanced"
      title={title}
      description="Live view from your IronShield data. This is not CrowdStrike Falcon cloud — features map to self-hosted telemetry and policies."
      actions={
        <button type="button" className="falcon-btn falcon-btn-ghost" onClick={load}>
          Refresh
        </button>
      }
    >
      {err ? <p className={styles.err}>{err}</p> : null}
      {loading && !payload ? <p className={styles.muted}>Loading…</p> : null}

      {payload?.area === 'identity' && d ? (
        <div className={styles.box}>
          <p className={styles.note}>
            CrowdStrike® Identity Protection is not replicated here. Below is <strong>host-reported and event-derived</strong>{' '}
            identity context from your estate.
          </p>
          <div className={styles.kpiRow}>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.posture_score ?? 0}</div>
              <div className={styles.kpiLab}>Zero Trust posture score</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.identity_coverage_pct ?? 0}%</div>
              <div className={styles.kpiLab}>Identity coverage</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.spread_accounts_3plus_hosts ?? 0}</div>
              <div className={styles.kpiLab}>Accounts on 3+ hosts</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>
                {(d.privileged_console_accounts ?? 0) + (d.privileged_event_accounts_7d ?? 0)}
              </div>
              <div className={styles.kpiLab}>Privileged-like accounts</div>
            </div>
          </div>
          <div className={styles.warn} style={{ marginBottom: '0.8rem' }}>
            <strong>Posture:</strong>{' '}
            <span className={`${styles.badge} ${styles[postureToneClass(d.posture_band)] || ''}`}>
              {(d.posture_band || 'unknown').toUpperCase()}
            </span>{' '}
            <span className={styles.muted}>
              Coverage: {d.endpoints_with_logged_in_user ?? 0}/{d.endpoints_total ?? 0} hosts with current user context.
            </span>
          </div>
          <h3 className={styles.sectionTitle}>Users seen on endpoints (console)</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Hosts</th>
                </tr>
              </thead>
              <tbody>
                {(d.hosts_by_console_user || []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.muted}>
                      No logged-in user reported on endpoints yet (heartbeats).
                    </td>
                  </tr>
                ) : (
                  d.hosts_by_console_user.map((row) => (
                    <tr key={row.username}>
                      <td className={styles.mono}>{row.username}</td>
                      <td>{row.host_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <h3 className={styles.sectionTitle}>Account spread risk (users on 3+ hosts)</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Hosts</th>
                </tr>
              </thead>
              <tbody>
                {(d.spread_accounts || []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.muted}>
                      No high-spread accounts detected from endpoint heartbeats.
                    </td>
                  </tr>
                ) : (
                  d.spread_accounts.map((row) => (
                    <tr key={row.username}>
                      <td className={styles.mono}>{row.username}</td>
                      <td>{row.host_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <h3 className={styles.sectionTitle}>Privileged-like account activity (console)</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Hosts</th>
                </tr>
              </thead>
              <tbody>
                {(d.privileged_console_accounts_list || []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.muted}>
                      No privileged-like console usernames observed.
                    </td>
                  </tr>
                ) : (
                  d.privileged_console_accounts_list.map((row) => (
                    <tr key={row.username}>
                      <td className={styles.mono}>{row.username}</td>
                      <td>{row.host_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <h3 className={styles.sectionTitle}>Top usernames in normalized events (7 days)</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Events</th>
                </tr>
              </thead>
              <tbody>
                {(d.top_usernames_in_events_7d || []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.muted}>
                      No usernames in telemetry window. <Link to="/events">Browse events →</Link>
                    </td>
                  </tr>
                ) : (
                  d.top_usernames_in_events_7d.map((row) => (
                    <tr key={row.username}>
                      <td className={styles.mono}>{row.username}</td>
                      <td>{row.event_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <h3 className={styles.sectionTitle}>Privileged-like usernames in events (7 days)</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Events</th>
                </tr>
              </thead>
              <tbody>
                {(d.privileged_event_accounts_list_7d || []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.muted}>
                      No privileged-like usernames in the current event window.
                    </td>
                  </tr>
                ) : (
                  d.privileged_event_accounts_list_7d.map((row) => (
                    <tr key={row.username}>
                      <td className={styles.mono}>{row.username}</td>
                      <td>{row.event_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className={styles.links}>
            <Link to="/events">Events</Link>
            {' · '}
            <Link to="/endpoints">Hosts</Link>
          </p>
        </div>
      ) : null}

      {payload?.area === 'exposure' && d ? (
        <div className={styles.box}>
          <p className={styles.note}>
            Not full attack-surface management (ASM). This aggregates <strong>observed outbound connections</strong> and{' '}
            <strong>destination IPs from events</strong> in your tenant.
          </p>
          <div className={styles.kpiRow}>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.network_connection_rows ?? 0}</div>
              <div className={styles.kpiLab}>Non-loopback connection rows</div>
            </div>
          </div>
          <h3 className={styles.sectionTitle}>Top remote IP:port (network_connections)</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Remote</th>
                  <th>Seen</th>
                  <th>Hosts</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {(d.top_remote_endpoints || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.muted}>
                      No connection inventory. Run triage with network collection or wait for agent push.{' '}
                      <Link to="/network">Network →</Link>
                    </td>
                  </tr>
                ) : (
                  d.top_remote_endpoints.map((row, i) => (
                    <tr key={`${row.remote_address}:${row.remote_port}:${i}`}>
                      <td className={styles.mono}>
                        {row.remote_address}:{row.remote_port}
                      </td>
                      <td>{row.seen}</td>
                      <td>{row.endpoint_count}</td>
                      <td>{fmtTime(row.last_seen)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <h3 className={styles.sectionTitle}>Top destination IPs from normalized events (7 days)</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>IP</th>
                  <th>Events</th>
                </tr>
              </thead>
              <tbody>
                {(d.top_destination_ips_from_events_7d || []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.muted}>
                      No outbound IPs in the window.
                    </td>
                  </tr>
                ) : (
                  d.top_destination_ips_from_events_7d.map((row) => (
                    <tr key={row.remote_ip}>
                      <td className={styles.mono}>{row.remote_ip}</td>
                      <td>{row.event_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className={styles.links}>
            <Link to="/network">Network activity</Link>
            {' · '}
            <Link to="/events">Events</Link>
          </p>
        </div>
      ) : null}

      {payload?.area === 'managed-hunting' && d ? (
        <div className={styles.box}>
          <p className={styles.note}>
            Overwatch in self-hosted mode combines <strong>saved hunts</strong>, <strong>XDR detections</strong>, and <strong>triage workflow</strong>.
            Use this view to prioritize analyst activity and run targeted hunts.
          </p>
          {d.tenant_note ? <p className={styles.warn}>{d.tenant_note}</p> : null}
          <div className={styles.kpiRow}>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.saved_hunt_count ?? 0}</div>
              <div className={styles.kpiLab}>Saved hunts</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.xdr_events_24h ?? 0}</div>
              <div className={styles.kpiLab}>XDR events (24h)</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.xdr_detections_24h ?? 0}</div>
              <div className={styles.kpiLab}>XDR detections (24h)</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.xdr_critical_24h ?? 0}</div>
              <div className={styles.kpiLab}>Critical detections</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.incidents_open ?? 0}</div>
              <div className={styles.kpiLab}>Open incidents</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.triage_pending ?? 0}</div>
              <div className={styles.kpiLab}>Pending triage</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.avg_hunt_matches_7d ?? 0}</div>
              <div className={styles.kpiLab}>Avg hunt matches (7d)</div>
            </div>
          </div>
          <h3 className={styles.sectionTitle}>Recommended Overwatch hunts</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Use case</th>
                  <th>Suggested filter</th>
                </tr>
              </thead>
              <tbody>
                {(d.recommendations || []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.muted}>
                      No recommendations available.
                    </td>
                  </tr>
                ) : (
                  d.recommendations.map((r) => (
                    <tr key={r.id}>
                      <td>{r.title}</td>
                      <td className={styles.mono}>{JSON.stringify(r.query_params || {})}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <h3 className={styles.sectionTitle}>Saved hunts</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {(d.saved_hunts || []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.muted}>
                      No saved hunts. <Link to="/hunting">Create one in Hunting →</Link>
                    </td>
                  </tr>
                ) : (
                  d.saved_hunts.map((h) => (
                    <tr key={h.id}>
                      <td>{h.name}</td>
                      <td className={styles.mono}>{fmtTime(h.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <h3 className={styles.sectionTitle}>Top endpoints by XDR detections (24h)</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Detections</th>
                </tr>
              </thead>
              <tbody>
                {(d.top_detection_endpoints_24h || []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.muted}>
                      No endpoint hotspots in the last 24h.
                    </td>
                  </tr>
                ) : (
                  d.top_detection_endpoints_24h.map((r) => (
                    <tr key={`${r.endpoint_id || 'none'}-${r.hostname || 'unknown'}`}>
                      <td>{r.hostname || `Endpoint #${r.endpoint_id ?? 'unknown'}`}</td>
                      <td>{r.detections}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <h3 className={styles.sectionTitle}>Recent hunt runs</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Hunt</th>
                  <th>Matches</th>
                </tr>
              </thead>
              <tbody>
                {(d.recent_runs || []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.muted}>
                      No runs recorded yet. Run a saved hunt from the Hunting page.
                    </td>
                  </tr>
                ) : (
                  d.recent_runs.map((r) => (
                    <tr key={r.id}>
                      <td>{r.hunt_name || `Hunt #${r.hunt_id}`}</td>
                      <td>{r.result_count ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className={styles.links}>
            <Link to="/hunting">Hunting</Link>
            {' · '}
            <Link to="/xdr/detections">XDR detections</Link>
            {' · '}
            <Link to="/triage">Triage queue</Link>
            {' · '}
            <Link to="/incidents">Incidents</Link>
          </p>
        </div>
      ) : null}

      {payload?.area === 'prevention-deep' && d ? (
        <div className={styles.box}>
          <p className={styles.note}>
            Kernel exploit drivers and USB device control are <strong>not</strong> implemented in the open agent. NGAV and containment below reflect{' '}
            <strong>real policy and sensor-reported status</strong> from your deployment.
          </p>
          <div className={styles.kpiRow}>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.endpoints_total ?? 0}</div>
              <div className={styles.kpiLab}>Endpoints</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.network_containment_active ?? 0}</div>
              <div className={styles.kpiLab}>Network containment</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.ngav_realtime_on ?? 0}</div>
              <div className={styles.kpiLab}>NGAV realtime on</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiVal}>{d.ngav_realtime_off ?? 0}</div>
              <div className={styles.kpiLab}>Realtime off / unknown</div>
            </div>
          </div>
          <h3 className={styles.sectionTitle}>NGAV prevention status (by host count)</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Hosts</th>
                </tr>
              </thead>
              <tbody>
                {(d.ngav_prevention_by_status || []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.muted}>
                      No NGAV status rows (table may be empty or agents not reporting).
                    </td>
                  </tr>
                ) : (
                  d.ngav_prevention_by_status.map((row) => (
                    <tr key={row.status}>
                      <td>{row.status}</td>
                      <td>{row.c}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className={styles.links}>
            <Link to="/av">Next-gen AV</Link>
            {' · '}
            <Link to="/policies">EDR policies</Link>
            {' · '}
            <Link to="/endpoints">Hosts</Link>
          </p>
        </div>
      ) : null}

      {payload?.area === 'integrations' && d ? (
        <div className={styles.box}>
          <p className={styles.note}>
            Native bidirectional SOAR connectors are limited in IronShield. Webhooks, notification channels, and SIEM export are the supported fabric paths.
          </p>
          <h3 className={styles.sectionTitle}>Notification channels</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {(d.notification_channels || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.muted}>
                      No channels configured. <Link to="/enterprise">Add under Enterprise settings →</Link>
                    </td>
                  </tr>
                ) : (
                  d.notification_channels.map((ch) => (
                    <tr key={ch.id}>
                      <td className={styles.mono}>{ch.type}</td>
                      <td>{ch.name || '—'}</td>
                      <td>
                        <span className={ch.is_active ? `${styles.badge} ${styles.badgeOn}` : `${styles.badge} ${styles.badgeOff}`}>
                          {ch.is_active ? 'Active' : 'Off'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {d.channels_by_type && Object.keys(d.channels_by_type).length > 0 ? (
            <>
              <h3 className={styles.sectionTitle}>Summary by type</h3>
              <ul className={styles.ul}>
                {Object.entries(d.channels_by_type).map(([type, v]) => (
                  <li key={type}>
                    <span className={styles.mono}>{type}</span>: {v.active} active / {v.total} total
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className={styles.links}>
            <Link to="/enterprise">Enterprise / channels</Link>
            {' · '}
            <Link to="/audit-logs">Audit &amp; activity</Link>
          </p>
          <p className={styles.muted} style={{ marginTop: '0.75rem' }}>
            SIEM NDJSON export (authenticated): <span className={styles.mono}>{d.siem_export_path}</span>
          </p>
        </div>
      ) : null}

      <p className={styles.note} style={{ marginTop: '1.25rem', maxWidth: '720px' }}>
        CrowdStrike® / Falcon™ are trademarks of CrowdStrike, Inc. IronShield is an independent self-hosted EDR.
      </p>
    </PageShell>
  );
}
