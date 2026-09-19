---
"changesets-gitlab": minor
---

Sync with `changesets/action` v2 (structure, behaviour and fixes).

**Breaking**

- Inputs renamed to match upstream: `publish` → `publish-script`, `version` → `version-script`, `commit` → `commit-message`, `title` → `pr-title`, `target_branch` → `pr-base-branch`. Set them through the underscore-normalized `INPUT_*` variable; the old names now error with the variable to use (inputs whose variable is unchanged keep working)
- `publishedPackages` output renamed to `published-packages`
- The split flow is now CLI commands (`select-mode`, `version`, `pack`, `publish`) instead of GitHub sub-actions, plus `pr-status`/`pr-comment`. `runPublish`/`runVersion` take a `gitlab: GitLab` instance and `runVersion` returns `RunVersionResult`
- `changeset version` is no longer run with its exit code ignored, so the `version` command fails when there is nothing to version, like upstream's `/version` sub-action

**Added**

- `pr-draft`, `create-gitlab-releases`, `push-git-tags` and `push-with-git-cli` inputs; with `push-with-git-cli: false` the release commit and tags are created through the GitLab API (via `commitChangesSinceBase`, the `@changesets/ghcommit` counterpart)
- `has-changesets` and `pr-number` outputs; every output uses upstream's `core.setOutput` (native `$GITHUB_OUTPUT`, otherwise `~/.changesets-gitlab.outputs`)

**Changed**

- Use the exact tags reported by `CHANGESETS_OUTPUT`, support the built-in `changeset publish` (`--from-pack-dir`) and run custom scripts and callbacks through `@actions/exec`
- `getChangelogEntry` follows upstream (`1d54b9e`): parse with a regex and return the raw changelog slice instead of re-serializing it through `remark`, dropping the `remark`/`unified` dependencies. It also recognizes `~~~` fences, keeping the edge case the previous `remark` implementation handled
- The split `version`/`publish` commands read `script` like the upstream sub-actions (falling back to `version-script`/`publish-script`)
- `pr-draft` mirrors upstream: `create`/`always` open a new merge request as draft, and only `always` converts an existing one (GitLab marks drafts with a `Draft:` title prefix)
- npm authentication is left to npm (Trusted Publishing/OIDC, otherwise `NODE_AUTH_TOKEN`); removed the `.npmrc`/`NPM_TOKEN` handling
- Git CLI authentication uses command-scoped `http.extraHeader` instead of writing the token into `.git/config`; `DEBUG_GITLAB_CREDENTIAL` now only unsilences the auth remote lookup
- All logging goes through `@actions/core` instead of `console.*`

**Fixed**

- Warn when a custom publish script does not produce `CHANGESETS_OUTPUT`, and fail on malformed output
- The empty-release-MR guard compares package versions, so it also works when the version command commits the changes
- Tag push failures warn (the tag may already exist), publish failures fail the job, and the `gitlab[bot]` identity is only a fallback
- Use fully-qualified refspecs for `git fetch`/`git push` so a branch or tag name cannot be interpreted as a git command option
- Point the merge request status comment links at the current Changesets FAQ (`https://changesets.dev/faq`)
- Apply the input-migration guards to the split `version`/`publish` commands too, and forward `remove-source-branch` from `version`
- Detect an already-checked-out branch by exit code, create the comment API lazily so a `changeset-release*` branch without `GITLAB_TOKEN` stays a no-op, and resolve `publish-plan-path` against `cwd`
- Keep paths with spaces or non-ASCII characters intact when committing through the GitLab API (`-z` parsing)
