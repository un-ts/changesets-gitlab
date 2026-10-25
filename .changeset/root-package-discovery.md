---
"changesets-gitlab": patch
---

**Fixed** Discover the root `package.json` in a multi-package workspace that includes `.` in its `workspaces`/`packages` globs. A changeset for the root package no longer fails in the comment command with `Found changeset … for package … which is not in the workspace` ([#276](https://github.com/un-ts/changesets-gitlab/issues/276)).
