# Threat model workbook (IronShield EDR)

Use this as **your** threat model substitute: complete the tables for **your** environment (network, identity provider, hosting). Replace placeholder values in **angle brackets**.

## 1. System context (high level)

| Element | Description (fill in) |
|:--------|:---------------------|
| **Product** | IronShield open-edr — Windows agent, Node API, MySQL, React dashboard |
| **Deployment** | \<e.g. single VM, K8s, MSSP multi-tenant\> |
| **Operators** | SOC analysts, admins, possibly MSSP tenants |
| **External actors** | End users on endpoints; internet-facing API if exposed |

## 2. Assets and impact

| Asset | Confidentiality | Integrity | Availability | Notes |
|:------|:----------------|:----------|:-------------|:------|
| Agent telemetry / events | High | High | Medium | Stored in DB; drives detections |
| Admin credentials (JWT, sessions) | High | High | Medium | `admin_users`, JWT in `server-node` |
| Agent keys | High | High | High | `X-Agent-Key`, rotation in API |
| Database | High | High | High | MySQL — backups, least privilege |
| Audit logs | Medium | High | Medium | `audit_logs`, optional archive |
| TLS keys / mTLS | High | High | High | Agent and API channels |

## 3. Trust boundaries

```
[ Internet / endpoints ]     TLS/mTLS?     [ Reverse proxy ]
       |                                        |
       v                                        v
[ Windows agent ] -------- HTTPS -----------> [ Node API : Express ]
       |                                        |
       |                                        v
       +------------------ JWT ----------------> [ React dashboard (browser) ]
                                                    |
                                                    v
                                              [ MySQL / Redis / Kafka ]
```

Update the diagram if you terminate TLS at a proxy, use SSO (OIDC/SAML), or split networks.

## 4. STRIDE (per component)

**S**poofing · **T**ampering · **R**epudiation · **I**nformation disclosure · **D**enial of service · **E**levation of privilege

| Component | S | T | R | I | D | E | Mitigations (repo / deploy) |
|:----------|:--|:--|:--|:--|:--|:--|:----------------------------|
| Agent → API | Agent key theft | Event tamper | — | Leak of payloads | Flood ingest | Agent runs admin tasks | mTLS option, key rotation, rate limits, RBAC on admin |
| Admin → API | Stolen JWT | — | Weak audit | — | API abuse | Privilege misuse | MFA policy, RBAC, SoD, `adminAuditTrail`, session_version |
| API → DB | — | SQLi if bugs | — | — | DB overload | DB superuser | Parameterized queries, least-privilege DB user |
| Dashboard | XSS if bugs | — | — | — | — | — | Helmet, CSP if enabled, React patterns |

Add rows for Kafka, Redis, SIEM webhooks, and third-party XDR ingest keys.

## 5. Top risks (prioritize remediation)

| # | Risk | Likelihood | Impact | Tracking |
|:--|:-----|:-----------|:-------|:---------|
| 1 | Exposed API without TLS | | | |
| 2 | Weak `JWT_SECRET` / leaked `.env` | | | |
| 3 | Stolen agent registration token | | | Prefer per-tenant enrollment tokens |
| 4 | Insider abuse of admin API | | | RBAC, audit, MFA |

## 6. Review cadence

- **Minor** (dependency bump, config tweak): update §5 if threat changes.
- **Major** (new integration, new network zone): full pass of §2–4.
- **Annual**: reconcile with [control-mapping.json](control-mapping.json) and [assurance-program.md](assurance-program.md).
