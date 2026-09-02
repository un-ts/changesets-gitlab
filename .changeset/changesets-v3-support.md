---
"changesets-gitlab": major
---

Add support for Changesets v3 by handling the new version command exit code (1 when no unreleased changesets), detecting published packages via the `CHANGESETS_OUTPUT` env var, and preventing empty release MRs when the version command produces no file changes.
