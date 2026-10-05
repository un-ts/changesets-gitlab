---
"changesets-gitlab": minor
---

**Added** the `changesets-gitlab/changelog` changelog generator for [Changesets](https://changesets.dev/guide/customize-changelog-format). It links each entry to the corresponding GitLab merge request, commit and author, linkifies `#123` issue and `!123` merge request references, and supports the `repo`, `disableThanks` and `template` options like [`@changesets/changelog-github`](https://github.com/changesets/changesets/tree/main/packages/changelog-github).

```json
{
  "changelog": ["changesets-gitlab/changelog", { "repo": "group/project" }]
}
```
