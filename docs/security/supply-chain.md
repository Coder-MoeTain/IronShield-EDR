# Supply chain security

## Dependency scanning

- **Node backend:** `npm audit --omit=dev --audit-level=high` runs in CI (`.github/workflows/ci.yml`).
- **Dashboard:** run `npm audit` in `server-node/dashboard` before releases.
- **Agent:** use `dotnet list package --vulnerable` on `EDR.Agent.sln`.

## SBOM

```bash
cd server-node
npm run sbom
```

Output: `server-node/artifacts/sbom-backend.json` (CycloneDX-style component list from `package-lock.json`).

## Static analysis

- **CodeQL:** `.github/workflows/codeql.yml`
- **Dependency review:** `.github/workflows/dependency-review.yml`

## Release signing

Agent update packages should be signed per `docs/security/agent-release-signing.md`. Agents verify signatures before applying updates.

## Secrets

Never commit `.env`, agent keys, or JWT secrets. Use `AGENT_KEY_PEPPER`, strong `JWT_SECRET`, and `METRICS_TOKEN` in production.
