---
"changesets-gitlab": patch
---

**Fixed** Forward the `GITLAB_TOKEN` authentication to the Changesets CLI and to custom version/publish scripts. The CLI runs `git fetch` itself (for example to deepen a shallow clone) and no longer fails with `could not read Username for 'https://…'` when the CI remote URL is not authenticated (#268).
