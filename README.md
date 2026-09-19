# changesets-gitlab

[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/un-ts/changesets-gitlab/ci.yml?branch=main)](https://github.com/un-ts/changesets-gitlab/actions/workflows/ci.yml?query=branch%3Amain)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/un-ts/changesets-gitlab)](https://coderabbit.ai)
[![npm](https://img.shields.io/npm/v/changesets-gitlab.svg)](https://www.npmjs.com/package/changesets-gitlab)
[![GitHub Release](https://img.shields.io/github/release/un-ts/changesets-gitlab)](https://github.com/un-ts/changesets-gitlab/releases)

[![Conventional Commits](https://img.shields.io/badge/conventional%20commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![changesets](https://img.shields.io/badge/maintained%20with-changesets-176de3.svg)](https://github.com/atlassian/changesets)

GitLab CI cli for [changesets](https://changesets.dev), like its [GitHub Action](https://github.com/changesets/action), it creates a merge request with all of the package versions and changelogs updated and updates it when there are new changesets on the default branch. When you're ready, you can merge the merge request and either publish the packages to npm manually or set it up to publish automatically. Check out the [Automating Changesets](https://changesets.dev/guide/automating) guide to learn more.

## Usage

### Requirements

- The repo checked out and `@changesets/cli` v3 installed
- `GITLAB_TOKEN` with permission to push, publish to the package registry and use the merge request API (the `CI_JOB_TOKEN` is not sufficient)
- A branch pipeline on the default branch for releasing, and a merge request pipeline for the `comment` command

### Inputs

> Note: environment variables are case-sensitive. Input names follow the same kebab-case as [`changesets/action`](https://github.com/changesets/action); because GitLab CI/CD variable names cannot contain hyphens, they are set through the underscore-normalized `INPUT_*` variable (`publish-script` is `INPUT_PUBLISH_SCRIPT`). Boolean inputs accept `true`/`false` (any YAML spelling) and GitLab-style `1`/`0`.

- `INPUT_PUBLISH_SCRIPT` - The command to use to build and publish packages
- `INPUT_VERSION_SCRIPT` - The command to update version, edit CHANGELOG, read and delete changesets. Default to `changeset version` if not provided
- `INPUT_COMMIT_MESSAGE` - The commit message. Default to `Version Packages`
- `INPUT_PR_TITLE` - The merge request title. Default to `Version Packages`
- `INPUT_PR_DRAFT` - Controls draft MR behavior. Use `create` to create new version MRs as draft, or `always` to also convert existing version MRs back to draft when updating them
- `INPUT_PR_BASE_BRANCH` - Sets the base branch of the merge request. Defaults to `CI_COMMIT_REF_NAME`
- `INPUT_CREATE_GITLAB_RELEASES` - Whether to create GitLab releases after publish
- `INPUT_PUSH_GIT_TAGS` - Whether to create git tags after publish. If `INPUT_CREATE_GITLAB_RELEASES` is `true`, this option will also always be `true`
- `INPUT_PUSH_WITH_GIT_CLI` - Whether to use the Git CLI instead of the GitLab API to push release commits and tags. Defaults to `true`. When using the GitLab API, commits and tags are attributed to the owner of `GITLAB_TOKEN`, and signed only if the instance signs commits
- `INPUT_CWD` - The working directory to execute Changesets in. Defaults to the root of the repository

#### Only available in `changesets-gitlab`

- `INPUT_PUBLISHED` - Command executed after publishing (receives `PUBLISHED` and `PUBLISHED_PACKAGES`)
- `INPUT_ONLY_CHANGESETS` - Command executed when changesets are detected
- `INPUT_REMOVE_SOURCE_BRANCH` - Enables the merge request "Delete source branch" checkbox. Default `false`
- `INPUT_LABELS` - Comma-separated labels for the version merge request

> Inputs renamed to match `changesets/action`: `INPUT_PUBLISH`, `INPUT_VERSION`, `INPUT_COMMIT`, `INPUT_TITLE` and `INPUT_TARGET_BRANCH` must be renamed (they now error with the variable to use). Inputs whose normalized variable is unchanged (`INPUT_CREATE_GITLAB_RELEASES`, `INPUT_REMOVE_SOURCE_BRANCH`, `INPUT_ONLY_CHANGESETS`) keep working.

### Commands

The CLI exposes separate commands, mirroring the `changesets/action` sub-actions. The default `main` command runs the whole release flow and is what most projects need; the others can be used to split the release across stages.

- `comment` - Comment on the merge request (like <https://github.com/changesets/bot>)
- `pr-status` - Generate changeset status in merge requests, and set the `comment-body` output
- `pr-comment` - Create or update comments on merge requests from `INPUT_BODY`, matched by the marker derived from `INPUT_UPDATE_ID` (default `changesets-gitlab-pr-comment`), and set the `comment-id` output
- `select-mode` - Select the mode to run a changesets workflow. Sets the `mode` (and `publish-plan-path` when publishing) outputs; pass `INPUT_PUBLISH_PLAN_PATH` to pin the plan to a fixed path
- `version` - Version packages and create or update a merge request with the changes
- `pack` - Pack publishable packages into tarballs. Accepts `--publish-plan <path>` and `--out-dir <dir>`, and sets the `pack-dir` output
- `publish` - Publish packages to npm. Accepts `--from-pack-dir <dir>`
- `main` - The default full flow (select-mode + version + publish)

```sh
# Split the release across stages, using fixed paths so they can be shared
export INPUT_PUBLISH_PLAN_PATH="$CI_PROJECT_DIR/.changeset-publish-plan/publish-plan.json"
npx changesets-gitlab select-mode
npx changesets-gitlab version
npx changesets-gitlab pack --publish-plan "$INPUT_PUBLISH_PLAN_PATH" --out-dir "$CI_PROJECT_DIR/.changeset-pack"
npx changesets-gitlab publish --from-pack-dir "$CI_PROJECT_DIR/.changeset-pack"
```

### Outputs

Every output is set with `@actions/core`. On GitHub Actions that writes the native `$GITHUB_OUTPUT` file; elsewhere it falls back to `~/.changesets-gitlab.outputs` (same `KEY<<delimiter` format), so a later step in the same job can read the values. Set `$GITHUB_OUTPUT` to an empty string to opt out of the fallback.

- `published` - A "true" or "false" string value to indicate whether a publishing is happened or not
- `published-packages` - A JSON array to present the published packages. The format is `[{"name": "@xx/xx", "version": "1.2.0"}, {"name": "@xx/xy", "version": "0.8.9"}]`
- `has-changesets` - A "true" or "false" string value about whether there were changesets. Useful if you want to create your own publishing functionality
- `pr-number` - The merge request number that was created or updated

The `select-mode` (`mode`, `publish-plan-path`), `pack` (`pack-dir`), `pr-status` (`comment-body`) and `pr-comment` (`comment-id`) commands expose their outputs the same way. The `INPUT_PUBLISHED` command is run with `PUBLISHED` and `PUBLISHED_PACKAGES` set in its environment; prefer explicit paths/options when a later job needs a value.

### Environment Variables

```sh
GLOBAL_AGENT_HTTP_PROXY  # optional, if you're using custom GitLab service under proxy
GLOBAL_AGENT_HTTPS_PROXY # As above but for https requests
GLOBAL_AGENT_NO_PROXY    # Like above but for no proxied requests

# http_proxy, https_proxy, no_proxy environment variables are supported at the same time

GITLAB_HOST # optional, if you're using custom GitLab host, will fallback to `CI_SERVER_URL` if not provided

GITLAB_TOKEN                           # required, token with accessibility to push, package registries, and merge request APIs. Note the CI_JOB_TOKEN does not have sufficient permissions
GITLAB_TOKEN_TYPE                      # optional, type of the provided token in GITLAB_TOKEN. defaults to personal access token. Can be `oauth` if you use Gitlab Oauth (personal access) token
GITLAB_CI_USER_NAME                    # optional, username with accessibility to push, used in pairs of the above token (if it was personal access token). If not set read it from the Gitlab API
GITLAB_CI_USER_EMAIL                   # optional, default `gitlab[bot]@users.noreply.gitlab.com`
GITLAB_COMMENT_TYPE                    # optional, type of the comment. defaults to `discussion`. can be set to `note` to not create a discussion instead of a thread
GITLAB_COMMENT_DISCUSSION_AUTO_RESOLVE # optional, automatically resolve added discussion when changeset is present, if you want to always resolve the discussion, you should actually use `GITLAB_COMMENT_TYPE=note` instead, default `true`
GITLAB_COMMENT_CUSTOM_LINKS            # optional, override the links content referenced in the cli bot comment, use {{ addChangesetUrl }} placeholder for the dynamic URL to add a changeset
GITLAB_ADD_CHANGESET_MESSAGE           # optional, default commit message for adding changesets on GitLab Web UI
DEBUG_GITLAB_CREDENTIAL                # optional, set to `1`/`true` to echo the remote URL when debugging git authentication; WARNING: the remote URL may contain credentials
```

### Example workflow

#### Without Publishing

Create a file at `.gitlab-ci.yml` with the following content.

```yml
stages:
  - comment
  - release

before_script: yarn --frozen-lockfile

comment:
  image: node:lts-alpine
  stage: comment
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script: npx changesets-gitlab comment # comment automatically like https://github.com/changesets/bot

release:
  image: node:lts-alpine
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script: npx changesets-gitlab
```

#### With Publishing

npm authentication is left to npm itself (the CLI never touches `~/.npmrc`). Use one of:

1. **Trusted Publishing / OIDC (preferred)**: configure npm Trusted Publishers for your GitLab pipeline (see the npm docs: <https://docs.npmjs.com/trusted-publishers#supported-cicd-providers>) and request `NPM_ID_TOKEN` in the release job with `id_tokens` (as in the example below). No token or `.npmrc` is needed.
2. **Classic automation token**: create an [npm automation token](https://docs.npmjs.com/creating-and-viewing-authentication-tokens) and expose it to the pipeline as `NODE_AUTH_TOKEN`:

   ```yml
   release:
     variables:
       NODE_AUTH_TOKEN: $NPM_TOKEN # a masked/protected GitLab CI variable
   ```

   If your npm version does not pick up `NODE_AUTH_TOKEN` on its own, reference it from a committed project `.npmrc`:

   ```sh
   //registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}
   ```

For either method, create a file at `.gitlab-ci.yml` with the following content:

```yml
stages:
  - comment
  - release

before_script: yarn --frozen-lockfile

comment:
  image: node:lts-alpine
  stage: comment
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script: npx changesets-gitlab comment

release:
  image: node:lts-alpine
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  id_tokens:
    NPM_ID_TOKEN:
      aud: npm:registry.npmjs.org
  script: npx changesets-gitlab
  variables:
    INPUT_PUBLISH_SCRIPT: yarn release
```

#### With version script

If you need to add additional logic to the version command, you can do so by using a version script.

If the version script is present, this action will run that script instead of `changeset version`, so please make sure that your script calls `changeset version` at some point. All the changes made by the script will be included in the MR.

```yml
stages:
  - comment
  - release

before_script: yarn --frozen-lockfile

comment:
  image: node:lts-alpine
  stage: comment
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script: npx changesets-gitlab comment

release:
  image: node:lts-alpine
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script: npx changesets-gitlab
  variables:
    INPUT_VERSION_SCRIPT: yarn version
```

#### With Yarn 2 / Plug'n'Play

If you are using [Yarn Plug'n'Play](https://yarnpkg.com/features/pnp), you should use a custom `version` command so that the action can resolve the `changeset` CLI:

```yml
stages:
  - comment
  - release

before_script: yarn --frozen-lockfile

comment:
  image: node:lts-alpine
  stage: comment
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script: npx changesets-gitlab comment

release:
  image: node:lts-alpine
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script: npx changesets-gitlab
  variables:
    INPUT_VERSION_SCRIPT: yarn changeset version
```

You may also want to run `yarn install` after the `changeset version` command to update the `yarn.lock` in the version MR. You need to disable immutable lock file setting using an env variable:

```yml
release:
  image: node:lts-alpine
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script: npx changesets-gitlab
  variables:
    YARN_ENABLE_IMMUTABLE_INSTALLS: 'false'
    INPUT_VERSION_SCRIPT: yarn update-versions
```

And your `update-versions` script would be:

```json
{
  "update-versions": "changeset version && yarn install"
}
```

## Sponsors

| 1stG                                                                                                                               | RxTS                                                                                                                               | UnTS                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective backers and sponsors](https://opencollective.com/1stG/organizations.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective backers and sponsors](https://opencollective.com/rxts/organizations.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective backers and sponsors](https://opencollective.com/unts/organizations.svg)](https://opencollective.com/unts) |

## Backers

[![Backers](https://raw.githubusercontent.com/1stG/static/master/sponsors.svg)](https://github.com/sponsors/JounQin)

| 1stG                                                                                                                             | RxTS                                                                                                                             | UnTS                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective backers and sponsors](https://opencollective.com/1stG/individuals.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective backers and sponsors](https://opencollective.com/rxts/individuals.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective backers and sponsors](https://opencollective.com/unts/individuals.svg)](https://opencollective.com/unts) |

## Changelog

Detailed changes for each release are documented in [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT][] © [JounQin][]@[1stG.me][]

[1stG.me]: https://www.1stG.me
[JounQin]: https://github.com/JounQin
[MIT]: http://opensource.org/licenses/MIT
