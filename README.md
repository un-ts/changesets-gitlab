# changesets-gitlab

GitLab CI cli for [changesets](https://github.com/atlassian/changesets) like its [GitHub Action](https://github.com/changesets/action), it creates a pull request with all of the package versions updated and changelogs updated and when there are new changesets on master, the PR will be updated. When you're ready, you can merge the pull request and you can either publish the packages to npm manually or setup the action to do it for you.

## Usage

### Inputs

> Environment valuables starts with `INPUT_`, case insensitive

- publish - The command to use to build and publish packages
- version - The command to update version, edit CHANGELOG, read and delete changesets. Default to `changeset version` if not provided
- commit - The commit message to use. Default to `Version Packages`
- title - The pull request title. Default to `Version Packages`

### Outputs

- published - A boolean value to indicate whether a publishing is happened or not
- publishedPackages - A JSON array to present the published packages. The format is `[{"name": "@xx/xx", "version": "1.2.0"}, {"name": "@xx/xy", "version": "0.8.9"}]`

### Environment Variables

```sh
GLOBAL_AGENT_HTTP_PROXY  # optional, if you're using custom GitLab service under proxy
GLOBAL_AGENT_HTTPS_PROXY # As above but for https requests
GLOBAL_AGENT_NO_PROXY    # Like above but for no proxied requests

# http_proxy, https_proxy, no_proxy environment variables are supported at the same time

GITLAB_HOST # optional, if you're using custom GitLab host

GITLAB_TOKEN         # required, token with accessibility to push
GITLAB_CI_USER_NAME  # required, username with accessibility to push, used in pairs of the above token
GITLAB_CI_USER_EMAIL # optional, default `gitlab[bot]@users.noreply.gitlab.com`
```

### Example workflow

#### Without Publishing

Create a file at `.gitlab-ci.yml` with the following content.

```yml
stages:
  - release

before_script: yarn --frozen-lockfile

release:
  image: node:lts-alpine
  only: main
  script: yarn changesets-gitlab
```

#### With Publishing

Before you can setup this action with publishing, you'll need to have an [npm token](https://docs.npmjs.com/creating-and-viewing-authentication-tokens) that can publish the packages in the repo you're setting up the action for and doesn't have 2FA on publish enabled ([2FA on auth can be enabled](https://docs.npmjs.com/about-two-factor-authentication)). You'll also need to [add it as a secret on your GitHub repo](https://help.github.com/en/articles/virtual-environments-for-github-actions#creating-and-using-secrets-encrypted-variables) with the name `NPM_TOKEN`. Once you've done that, you can create a file at `.github/workflows/release.yml` with the following content.

```yml
stages:
  - release

before_script: yarn --frozen-lockfile

release:
  image: node:lts-alpine
  only: main
  script: yarn changesets-gitlab
  variables:
    INPUT_PUBLISH: yarn release
```

By default the GitHub Action creates a `.npmrc` file with the following content:

```sh
//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}
```

However, if a `.npmrc` file is found, the GitHub Action does not recreate the file. This is useful if you need to configure the `.npmrc` file on your own.
For example, you can add a step before running the Changesets GitHub Action:

```yml
script: |
  cat << EOF > "$HOME/.npmrc"
    email=my@email.com
    //registry.npmjs.org/:_authToken=$NPM_TOKEN
  EOF
```

#### With version script

If you need to add additional logic to the version command, you can do so by using a version script.

If the version script is present, this action will run that script instead of `changeset version`, so please make sure that your script calls `changeset version` at some point. All the changes made by the script will be included in the PR.

```yml
stages:
  - release

before_script: yarn --frozen-lockfile

release:
  image: node:lts-alpine
  only: main
  script: yarn changesets-gitlab
  variables:
    INPUT_VERSION: yarn version
```

#### With Yarn 2 / Plug'n'Play

If you are using [Yarn Plug'n'Play](https://yarnpkg.com/features/pnp), you should use a custom `version` command so that the action can resolve the `changeset` CLI:

```yml
stages:
  - release

before_script: yarn --frozen-lockfile

release:
  image: node:lts-alpine
  only: main
  script: yarn changesets-gitlab
  variables:
    INPUT_VERSION: yarn changeset version
```
