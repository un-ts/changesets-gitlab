---
"changesets-gitlab": minor
---

Refresh dependencies, including several major upgrades:

- `@actions/core` v2 → v3 and `@actions/exec` v1 → v3
- `@gitbeaker/rest` v42 → v43 — request error messages now include only the description context
- `commander` v13 → v15 — now ESM-only and requires Node.js ≥ 22.12 (`require(esm)`); the deprecated `commander/esm.mjs` export was removed
- `dotenv` v16 → v17
- `global-agent` v3 → v4
- `p-limit` v6 → v7

Dev tooling majors were upgraded as well (`eslint` v10, `typescript` v6 / native preview, `vitest` v5, `size-limit` v14, `@pkgr/rollup` v7, `npm-run-all2` v9, `nano-staged` v1).
