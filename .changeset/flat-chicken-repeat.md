---
'changesets-gitlab': minor
---

Add missing dependencies to the package.json
Add support for job tokens and oauth tokens (via GITLAB_TOKEN_TYPE config), The Gitlab job tokens have limited access to Gitlab package registry so we cannot use it until [this Epic](https://gitlab.com/groups/gitlab-org/-/epics/3559) gets resolved. 
Add eslintcache to gitignore