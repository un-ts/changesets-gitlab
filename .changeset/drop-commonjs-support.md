---
"changesets-gitlab": minor
---

**Breaking** Drop CommonJS support, matching the ESM-only `changesets/action`: the package no longer ships a `require`-able entry (`lib/index.cjs` / `index.d.cts`), and only `import` is supported.
