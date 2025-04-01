---
"changesets-gitlab": minor
---

feat: add a new optional `GITLAB_COMMENT_DISCUSSION_AUTO_RESOLVE` environment variable to automatically resolve added discussion when changeset is present, if you want to always resolve the discussion, you should actually use `GITLAB_COMMENT_TYPE=note` instead, default `true`
