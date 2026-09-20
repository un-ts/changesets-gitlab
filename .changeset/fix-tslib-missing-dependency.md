---
"changesets-gitlab": patch
---

Add `tslib` to `dependencies`. The compiled output imports `tslib` at runtime (via the `importHelpers` tsconfig option), but it was missing from `package.json`, causing `ERR_MODULE_NOT_FOUND: Cannot find package 'tslib'` when running via `npx`.
