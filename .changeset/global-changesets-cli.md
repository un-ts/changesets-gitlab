---
"changesets-gitlab": patch
---

**Fixed** Resolve the Changesets CLI from the package manager's global directory (npm/yarn/pnpm) as a fallback when it is not installed in the repository. A globally installed `changesets-gitlab` no longer fails with `Have you forgotten to install @changesets/cli` (#125).
