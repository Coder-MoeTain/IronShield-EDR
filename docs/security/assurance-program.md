# Assurance program (substitute for periodic penetration testing)

**Scope:** This program provides **continuous, repeatable checks** plus a **manual review checklist**. It is **not** equivalent to an independent penetration test or red team exercise. Use it to catch regressions early and to document due diligence; add **external** testing when policy or risk requires it.

## Part A — Automated (run in CI or before release)

| Check | Command | Pass criteria |
|:------|:----------|:--------------|
| Dependency vulnerabilities | `cd server-node && npm run security-assurance` | No critical issues in `--strict` mode (adjust policy as needed) |
| Security unit tests | Same script runs `node --test` on `server-node/test` | All tests green |
| Control mapping file valid JSON | Parsed by script | `docs/security/control-mapping.json` parses |

Optional additions you can bolt on (not in repo by default):

- Static analysis (ESLint security plugins, SonarQube, Semgrep).
- Container image scanning if you dockerize.
- DAST against a staging URL (OWASP ZAP, etc.).

## Part B — Manual review (quarterly suggested)

Complete and store with your change records (tick when done):

- [ ] **TLS**: Production API uses HTTPS end-to-end; `TRUST_PROXY` correct behind load balancer.
- [ ] **Secrets**: No secrets in git; rotation schedule for `JWT_SECRET`, DB password, agent registration tokens.
- [ ] **CORS**: `CORS_ORIGINS` allowlist set for production dashboard origins.
- [ ] **Database**: App DB user is least-privilege; backups tested restore.
- [ ] **Agent**: mTLS enabled in production if required by policy; enrollment tokens scoped per tenant.
- [ ] **Audit**: Sample `audit_logs` / archive for tamper-evidence; SIEM export path works if used.
- [ ] **Access**: MFA enforced for admins if policy requires; dormant admin users disabled.

## Part C — What still needs a human pentest

| Topic | Why automation is insufficient |
|:------|:--------------------------------|
| Business logic flaws | Abuse cases across multi-step workflows |
| AuthZ edge cases | Tenant bypass, IDOR across resources |
| Client-side issues | DOM XSS, stored XSS in rich fields |
| Social engineering | Out of scope for scripts |
| Physical / org controls | Badging, clean desk, vendor reviews |

**Recommendation:** External **annual** pentest (or after major architecture change) with scope including admin API, agent API, and dashboard.

## Evidence bundle

For audits, collect:

1. Latest `npm audit` output (or tool report).
2. Test run log from `security-assurance`.
3. This checklist (Part B) signed/dated.
4. Updated [control-mapping.json](control-mapping.json) with `last_reviewed` set.
