# Security assurance (substitute artifacts)

This folder provides **structured substitutes** for three activities that are normally done outside the codebase: **threat modeling**, **penetration testing**, and **control mapping**. They do **not** replace a qualified assessor or a real pentest; they give you **repeatable documentation and automation** you own and can extend.

| Artifact | File | Purpose |
|:-----------|:-----|:--------|
| Threat model (STRIDE + DFD) | [threat-model.md](threat-model.md) | Identify assets, trust boundaries, and misuse cases for *your* deployment. |
| Control mapping | [control-mapping.json](control-mapping.json) | Map frameworks (NIST CSF–style) to implementation evidence in this repo. |
| Pentest substitute | [assurance-program.md](assurance-program.md) | Automated checks + manual review cadence + scope limits. |
| SOC gap matrix | [soc-gap-matrix.md](soc-gap-matrix.md) | Maps EDR/SOC expectations to repo features vs operational work. |

## Quick commands

From `server-node`:

```bash
npm run security-assurance
```

Strict mode (exit non-zero on high/critical `npm audit` findings):

```bash
npm run security-assurance -- --strict
```

Update `control-mapping.json` as you change architecture or deploy new controls. Re-run the assurance script in CI or before releases.

## Relationship to external work

- **Threat model**: Filling [threat-model.md](threat-model.md) is your living STRIDE/DFD record; update when components or trust boundaries change.
- **Pentest**: The script and checklist are **continuous assurance**; schedule an **external** pentest for independent validation when risk or compliance requires it.
- **Control mapping**: JSON is **evidence-oriented**; auditors often want exports — run `npm run export-compliance-evidence` from `server-node` if configured, plus this mapping.
