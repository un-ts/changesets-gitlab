---
"changesets-gitlab": patch
---

**Fixed** `runVersion` resets the `changeset-release/*` branch to the pipeline trigger commit (`CI_COMMIT_SHA`) instead of the latest `origin/${branch}` tip, matching `changesets/action`. A delayed pipeline can no longer version changesets it never saw (#236). This makes the `CI_COMMIT_SHA`, `CI_COMMIT_REF_NAME` and `CI_PROJECT_ID` environment variables required: GitLab CI injects them automatically, but other CI environments must set them explicitly.
