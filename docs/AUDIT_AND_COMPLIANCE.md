# IronShield EDR — Audit and Compliance

## Audited actions

- Authentication (login, logout, failures, MFA)
- User and role changes, tenant switch (super_admin)
- Agent enrollment, key rotation, cert binding/mismatch
- Detection rule changes, approvals, suppressions
- Response actions and RTR session commands
- Software inventory upload, notify, block/unblock, accept-risk
- Vulnerability database changes, report exports
- Integration and settings changes, emergency unblock

## Hash chain integrity

Audit entries include `prev_hash` and `entry_hash` for tamper detection.

```bash
cd server-node
npm run audit:verify
```

**API:** `GET /api/v1/admin/audit-logs/verify`

## Export

Auditors with `audit:view` and `audit:export` can export audit logs and compliance summaries from the Admin module.

See [SECURITY_MODEL.md](SECURITY_MODEL.md) and [security/assurance-program.md](security/assurance-program.md).
