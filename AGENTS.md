# Agent Guide

This document helps AI agents (and humans) understand and work with this repository. Read it before making changes.

## Project Overview

`changesets-gitlab` runs the [Changesets](https://changesets.dev) release flow on GitLab CI: it opens/updates a "Version Packages" merge request and, optionally, publishes packages and creates GitLab releases and git tags. It mirrors [`changesets/action`](https://github.com/changesets/action) v2 almost 1:1, adapted to GitLab (merge requests instead of PRs, `GITLAB_TOKEN`/GitLab API instead of Octokit).

- npm package and binary: `changesets-gitlab` (`lib/cli.js`)
- Upstream reference: `changesets/action`, usually checked out next to this repo as `../action`

**Guiding principle: stay as close to `changesets/action` as possible (AMAP). Only diverge for GitLab-specific requirements or genuine bug fixes, and document the divergence.**

## Stack and Tooling

- Node.js `^22.12 || ^24 || >=26`; TypeScript; ESM (`"type": "module"`)
- Yarn 4 (Berry, `node-modules` linker, pinned in `.yarnrc.yml`) — use `yarn`, not `npm`/`pnpm`
- Lint: `@1stg/eslint-config` + `tsc --noEmit`; format: `@1stg/prettier-config`
- Tests: Vitest (Istanbul coverage); type coverage: `type-coverage` at **100%**
- Build: `@pkgr/rollup` (`r -f cjs`) + `tsc -p tsconfig.lib.json` → `lib/`
- Hooks: `simple-git-hooks` → `nano-staged` (pre-commit) and `commitlint` (commit-msg)

## Commands

```bash
corepack enable && yarn --immutable # install

yarn lint       # eslint + tsc --noEmit
yarn test       # vitest run (coverage enabled)
yarn build      # build lib/ (rollup + tsc)
yarn build:ts   # type-check and emit only declarations
yarn cli        # run the CLI from source (tsx src/cli)
yarn format     # prettier --write .
yarn typecov    # type-coverage; must stay at 100%
yarn size-limit # bundle-size budget for lib/index.js

# run a single spec
yarn vitest run test/run.spec.ts

# add a changeset for a user-facing change
yarn changeset
```

Always run `yarn lint` and `yarn test` before committing. CI runs `yarn run-s build lint test` on Node 22/24/26.

## Project Structure

| Path                                | Purpose                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `src/cli.ts`                        | CLI entry (`commander`); wires all commands                                 |
| `src/main.ts`                       | Default `main` command: the whole release flow                              |
| `src/select-mode.ts`                | `select-mode` command (decides version vs publish)                          |
| `src/version.ts`                    | `version` command (split release)                                           |
| `src/pack.ts`                       | `pack` command (tarballs from a publish plan)                               |
| `src/publish.ts`                    | `publish` command (split release)                                           |
| `src/comment.ts`                    | Shared MR changeset status/comment logic                                    |
| `src/pr-status.ts`                  | `pr-status` command (upstream `/pr-status`)                                 |
| `src/pr-comment.ts`                 | `pr-comment` command (upstream `/pr-comment`)                               |
| `src/run.ts`                        | `runPublish` / `runVersion` (upstream `run.ts`)                             |
| `src/gitlab.ts`                     | `GitLab` client: git + GitLab API (upstream `github.ts`)                    |
| `src/api.ts`                        | Cached Gitbeaker client (`createApi`) and the `GitLabApi` type              |
| `src/env.ts`                        | Environment/input access (`INPUT_*`, `GITLAB_*`, `CI_*`)                    |
| `src/context.ts`                    | GitLab CI context (`projectId`, `ref`, `sha`, …)                            |
| `src/utils.ts`                      | Input/output helpers, exec helpers, `commitChangesSinceBase`, `getUsername` |
| `src/get-changed-packages.ts`       | Changed packages and changed-changeset detection                            |
| `src/read-changeset-state.ts`       | Reads Changesets state (changesets, pre mode)                               |
| `src/constants.ts` / `src/types.ts` | Boolean parsers and shared types                                            |
| `src/index.ts`                      | Public exports                                                              |
| `test/*.spec.ts`                    | Vitest specs (+ `fixtures/`, `__snapshots__/`)                              |

## Upstream File Mapping

`changesets/action` lives in a sibling checkout (usually `../action`). Its root action is `src/index.ts` and each sub-action is `src/<name>/index.ts` (built to `dist/<name>.js`); this port exposes those entry points as CLI commands. Keep the mapping in mind when syncing changes from upstream:

| `changesets/action`                                                     | `changesets-gitlab`                                                                |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `action.yml` + `src/index.ts` (root action)                             | `src/main.ts` (`main` command) + `src/cli.ts`                                      |
| `src/version/index.ts` / `src/publish/index.ts` / `src/pack/index.ts`   | `src/version.ts` / `src/publish.ts` / `src/pack.ts`                                |
| `src/select-mode/index.ts`                                              | `src/select-mode.ts`                                                               |
| `src/pr-status/index.ts` (+ `message.ts`, `template.ts`, `worktree.ts`) | `src/pr-status.ts` + `src/comment.ts`                                              |
| `src/pr-comment/index.ts`                                               | `src/pr-comment.ts`                                                                |
| `src/run.ts`                                                            | `src/run.ts`                                                                       |
| `src/utils.ts` (+ `getChangedPackages`)                                 | `src/utils.ts` + `src/get-changed-packages.ts`                                     |
| `src/readChangesetState.ts`                                             | `src/read-changeset-state.ts`                                                      |
| `src/github.ts`                                                         | `src/gitlab.ts`                                                                    |
| `src/octokit.ts`                                                        | `src/api.ts`                                                                       |
| `@actions/github` `context` / `core.getInput`                           | `src/context.ts` / `src/env.ts`                                                    |
| — (Changesets bot posts the comment)                                    | `src/comment.ts` (GitLab MR comment shared by `comment` and `pr-status`)           |
| — (no `action.yml`, no library entry)                                   | `src/cli.ts`, `src/index.ts` (library exports), `src/constants.ts`, `src/types.ts` |

Notes:

- There is no `action.yml` here. Upstream input/default changes land in `src/env.ts` / `src/utils.ts` and the user-facing contract in `README.md`; sub-action entry changes land in the matching `src/*.ts` command module and `src/cli.ts`.
- `src/index.ts` in this repo is a library barrel and does **not** correspond to upstream's `src/index.ts` — that role belongs to `src/main.ts`.
- When syncing, diff `src/run.ts`, `src/utils.ts` and `src/read-changeset-state.ts` first (they are near-copies of upstream), then re-apply the GitLab-specific parts in `src/gitlab.ts`, `src/api.ts`, `src/env.ts`, `src/context.ts` and `src/comment.ts`.

## Conventions

- Keep diffs minimal and behavior close to upstream. `README.md` is the user-facing contract for inputs, outputs and commands.
- Inputs are read through underscore-normalized `INPUT_*` variables (`getOptionalInput`, `getBooleanInput`, `getRequiredInput`) because GitLab CI/CD variable names cannot contain hyphens. Reject renamed/removed inputs with `throwOnRenamedInputs` / `throwOnRemovedCommitModeInput`; apply the guards in every command that reads them, not just `main`.
- Outputs go through `core.setOutput` only. `setOutput` wraps it and falls back to `~/.changesets-gitlab.outputs` when `$GITHUB_OUTPUT` is unavailable.
- Run external commands through `@actions/exec` (`exec`, `getExecOutput`) — never `child_process` or a shell. Pass fully-qualified refspecs / `--` when the argument can come from CI, so it cannot be parsed as a git option.
- Log through `@actions/core` (`core.info`/`core.warning`/`core.error`/`core.debug`), not `console.*`.
- Use `import type` for types and keep `type-coverage` at 100% (no `any`; annotate empty arrays/objects).
- Relative imports normally use the `.js` extension (`./utils.js`); the handful of modules that import `./api.ts` / `./env.ts` keep the `.ts` spelling.
- Formatting is enforced by `@1stg` Prettier/ESLint: single quotes, no semicolons, trailing commas. Run `yarn format` instead of hand-formatting.
- Recurring ESLint rules to design around:
  - `sonarjs/cognitive-complexity` (max 15): extract a helper instead of nesting further.
  - `unicorn-x/no-negated-condition`, `no-negated-condition`, `unicorn-x/prefer-ternary`: prefer an early `return` over `if (!x) { … } else { … }`.
- `lib/index.js` is budgeted at 150 B (brotlied); keep the public entry tiny. `lib/cli.js` is not part of the budget.

## Testing

- `test/run.spec.ts` creates real temporary git repositories (`createRepo`) and fakes the GitLab API objects. Prefer extending that pattern over mocking `@actions/exec` for git behavior.
- `test/get-changed-packages.spec.ts` and `test/utils.spec.ts` cover the pure helpers; `test/fixtures/` holds markdown inputs.
- Add or update a test for every behavioral change and keep `test/__snapshots__/` in sync.

## Changesets and Commits

- Every user-facing change needs a changeset (`.changeset/*.md` or `yarn changeset`). Keep it concise; follow the existing entries, which use `**Breaking**`, `**Added**`, `**Changed**`, `**Fixed**` headings.
- Commits follow Conventional Commits (`@1stg/commitlint-config`): `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, … The `commit-msg` hook enforces this.
- The `pre-commit` hook runs `nano-staged` (prettier, eslint, `tsc`, `type-coverage`). If it fails the commit is aborted — fix the cause, don't bypass with `--no-verify`.
- Stale gitignored build output can break `type-coverage` in the hook; `rm -rf lib coverage` before committing if it reports type-coverage failures on generated `.d.ts` files.

## Git and PRs

- Stage only the files you changed (`git add <path>`); avoid `git add -A` / `git add .` in a dirty tree.
- Don't use `git reset --hard`, `git clean -fd`, or `git commit --no-verify` unless the user explicitly asks.
- Inspect PRs and reviews with `gh pr view` / `gh pr diff` / `gh api` and `git show <ref>:<path>` instead of switching the working tree.

## Gotchas

- **`createApi()` can fail the job.** `env.GITLAB_TOKEN` calls `core.setFailed` when the token is missing, so never create the API (or evaluate a default parameter) before the code paths that are meant to be no-ops, such as a `changeset-release*` branch.
- **GitLab variable names have no hyphens.** Use the underscore `INPUT_*` name in CI examples, and remember that CI-provided `CI_*` variables are strings even when numeric.
- **`pushWithGitCli` defaults to `true`.** With `false`, release commits and tags are created through the GitLab API (`commitChangesSinceBase`); tag pushes still warn instead of throwing so an already-existing tag doesn't fail the job.
- **Messages and modes must match upstream.** Sub-action names, input/output names and the CLI command names are part of the public contract; changing them is a breaking change.

## Reusing the Package

The package is both a CLI and a library.

- CLI (GitLab CI `script`):
  ```sh
  npx changesets-gitlab [comment | pr-status | pr-comment | select-mode | version | pack | publish | main]
  ```
- Library (embed the flow in another runner):
  ```ts
  import { GitLab, runPublish, runVersion } from 'changesets-gitlab'

  const cwd = process.cwd()
  const gitlab = new GitLab({
    gitlabToken: process.env.GITLAB_TOKEN,
    cwd,
    pushWithGitCli: true,
  })

  const { pullRequestNumber } = await runVersion({ gitlab, cwd })
  const result = await runPublish({ gitlab, cwd })
  ```
- `createApi(token?)` returns a cached Gitbeaker client; `GitLab` wraps git and GitLab operations, mirroring upstream's GitHub client. Keep platform-specific behavior behind `src/gitlab.ts`, `src/api.ts`, `src/env.ts` and `src/context.ts` so `src/run.ts`, `src/comment.ts` and the command modules stay platform-agnostic and reusable.

## Reusing This Guide

The **Stack and Tooling**, **Commands**, **Conventions**, **Changesets and Commits** and **Git and PRs** sections describe the shared `@1stg` + Yarn 4 setup and can be copied into sibling repositories mostly unchanged. The **Project Overview**, **Project Structure**, **Upstream File Mapping**, **Testing**, **Gotchas** and **Reusing the Package** sections are specific to `changesets-gitlab` and should be rewritten per project.

## User Override

If the user's instructions conflict with this document, follow the user, but call out the conflict and confirm before overriding a rule above.
