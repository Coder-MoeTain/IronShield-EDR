# SOC / EDR gap matrix (in-repo vs operational)

This document lists **professional EDR/SOC expectations** and how this repository addresses them **excluding HTTPS termination and cloud-specific controls** (those remain deployment responsibilities).

| Area | Expectation | In-repo / automation | Operational gap |
|:-----|:-------------|:-----------------------|:-----------------|
| Identity & sessions | MFA, lockout, session revocation | Local MFA, `session_version` in JWT, SSO hooks | IdP policies, periodic access reviews |
| JWT lifecycle | Secret rotation without mass logout | `JWT_SECRET` + optional `JWT_SECRET_PREVIOUS` (`jwtVerify`) | Key ceremony, rotation runbooks |
| Audit trail | Tamper-evidence, no silent loss | Hash-chained `audit_logs`, NDJSON archive, **audit failure spill file** | SIEM routing, WORM storage, legal hold |
| Request tracing | Correlate UI ↔ API ↔ logs | `X-Request-ID`, `requestId` on errors and admin audit | Log pipeline fields, retention |
| Agent authenticity | Key lifecycle, optional mTLS | DB-validated keys, optional agent mTLS | PKI operations, cert renewal |
| Detection & response | Detections, playbooks, RTR | XDR modules, playbooks, agent executors | Tuning, purple team, SOAR |
| Data governance | Retention, RBAC, tenant isolation | Retention jobs, tenant-scoped queries | DLP, classification, contracts |
| Assurance | Repeatable security checks | `npm run security-assurance`, `docs/security/*` | External pentest, control audits |

## What “done” means here

Code and docs cover **rotation-friendly JWT verification**, **non-blocking audit with spill**, and **request correlation** end-to-end. Remaining SOC maturity is mostly **process and environment**: SIEM onboarding, staffing/runbooks, threat intel feeds, and formal risk acceptance for any deployment shortcuts.
