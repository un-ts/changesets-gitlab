import { Buffer } from 'node:buffer'

import * as core from '@actions/core'
import { exec, getExecOutput } from '@actions/exec'

import { createApi, type GitLabApi } from './api.ts'
import { TRUTHY_VALUES } from './constants.js'
import * as context from './context.js'
import { env } from './env.js'
import { commitChangesSinceBase, getUsername } from './utils.js'

interface GitOptions {
  cwd: string
  env?: Record<string, string>
}

const push = async (branch: string, options: GitOptions) => {
  await exec('git', ['push', 'origin', `HEAD:${branch}`, '--force'], options)
}

const switchToMaybeExistingBranch = async (
  branch: string,
  options: GitOptions,
) => {
  const { stderr } = await getExecOutput('git', ['checkout', branch], {
    ignoreReturnCode: true,
    ...options,
  })
  const stderrString = stderr.toString()
  const isCreatingBranch =
    !stderrString.includes(`Switched to branch '${branch}'`) &&
    // it could be a detached HEAD
    !stderrString.includes(`Switched to a new branch '${branch}'`)
  if (isCreatingBranch) {
    await exec('git', ['checkout', '-b', branch], options)
  }
}

const reset = async (pathSpec: string, options: GitOptions) => {
  await exec('git', ['reset', '--hard', pathSpec], options)
}

const commitAll = async (message: string, options: GitOptions) => {
  await exec('git', ['add', '-A', '.'], options)
  await exec('git', ['commit', '-m', message], options)
}

const checkIfClean = async (options: GitOptions): Promise<boolean> => {
  const { stdout } = await getExecOutput(
    'git',
    ['status', '--porcelain'],
    options,
  )
  return stdout.length === 0
}

function getHttpUrl(remoteUrl: string): string | undefined {
  try {
    const url = new URL(remoteUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return
    }

    // Git includes the username when deciding which URL-specific config is
    // most specific, so retain it. Password, query, and fragment do not
    // participate in matching; strip them before copying the URL into the env.
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.href
  } catch {
    return
  }
}

export class GitLab {
  readonly api: GitLabApi
  readonly cwd: string
  readonly pushWithGitCli: boolean
  readonly serverUrl: string
  readonly #gitlabToken: string

  constructor(options: {
    gitlabToken: string
    cwd: string
    pushWithGitCli?: boolean
    serverUrl?: string
  }) {
    this.#gitlabToken = options.gitlabToken
    this.cwd = options.cwd
    this.pushWithGitCli = options.pushWithGitCli ?? true
    this.serverUrl = (options.serverUrl ?? env.GITLAB_HOST).replace(/\/$/, '')
    this.api = createApi(options.gitlabToken)
  }

  getToken() {
    return this.#gitlabToken
  }

  async ensureGitUser() {
    // Check the exact identities that Git would use for commits without
    // allowing Git to fall back to auto-detected values like user@hostname.
    // This covers explicit GIT_AUTHOR_* / GIT_COMMITTER_* env vars, local
    // config, and global config. A partial identity, with only a name or only
    // an email, does not pass this check. If either identity is missing,
    // configure our default bot user as a fallback.
    const authorIdentity = await getExecOutput(
      'git',
      ['-c', 'user.useConfigOnly=true', 'var', 'GIT_AUTHOR_IDENT'],
      {
        cwd: this.cwd,
        ignoreReturnCode: true,
        silent: true,
      },
    )
    const committerIdentity = await getExecOutput(
      'git',
      ['-c', 'user.useConfigOnly=true', 'var', 'GIT_COMMITTER_IDENT'],
      {
        cwd: this.cwd,
        ignoreReturnCode: true,
        silent: true,
      },
    )
    if (authorIdentity.exitCode === 0 && committerIdentity.exitCode === 0) {
      return
    }
    core.info('Setting git user to gitlab[bot]')
    await exec(
      'git',
      ['config', 'user.name', env.GITLAB_CI_USER_NAME || env.GITLAB_USER_NAME],
      {
        cwd: this.cwd,
      },
    )
    await exec('git', ['config', 'user.email', env.GITLAB_CI_USER_EMAIL], {
      cwd: this.cwd,
    })
  }

  async pushTag(tag: string) {
    try {
      if (!this.pushWithGitCli) {
        await this.api.Tags.create(context.projectId, tag, context.sha)
        return
      }
      // The fully-qualified refspec keeps a tag coming from
      // `CHANGESETS_OUTPUT` from being parsed as a `git push` option
      // (e.g. `--upload-pack`).
      await exec('git', ['push', 'origin', `refs/tags/${tag}`], {
        cwd: this.cwd,
        env: {
          ...process.env,
          ...(await this.#getCliAuthEnv()),
        } as Record<string, string>,
      })
    } catch (err) {
      core.warning(
        `Failed to create git tag "${tag}". Assuming it was manually pushed by the publish script: ${
          (err as Error).message
        }`,
      )
    }
  }

  async pushTags(tags: string[]) {
    if (tags.length === 0) {
      return
    }
    // Push only the reported tags, in a single command, using fully-qualified
    // refspecs so they cannot be interpreted as `git push` options.
    const { stderr, exitCode } = await getExecOutput(
      'git',
      ['push', 'origin', ...tags.map(tag => `refs/tags/${tag}`)],
      {
        cwd: this.cwd,
        ignoreReturnCode: true,
        env: {
          ...process.env,
          ...(await this.#getCliAuthEnv()),
        } as Record<string, string>,
      },
    )
    // Changesets may have already pushed some of these tags on a previous run,
    // so a nonzero exit caused only by "already exists" rejections is expected
    // and safe to ignore. Any other failure is a real error.
    if (exitCode !== 0 && !stderr.includes('already exists')) {
      throw new Error(`Failed to push tags: ${stderr}`)
    }
  }

  async prepareBranch(branch: string, baseBranch: string) {
    await switchToMaybeExistingBranch(branch, { cwd: this.cwd })
    await exec('git', ['fetch', 'origin', baseBranch], {
      cwd: this.cwd,
      env: {
        ...process.env,
        ...(await this.#getCliAuthEnv()),
      } as Record<string, string>,
    })
    await reset(`origin/${baseBranch}`, { cwd: this.cwd })
  }

  async pushChanges({ branch, message }: { branch: string; message: string }) {
    if (!this.pushWithGitCli) {
      await commitChangesSinceBase({
        api: this.api,
        projectId: context.projectId,
        branch,
        message,
        base: { commit: context.sha },
        force: true,
        cwd: this.cwd,
      })
      return
    }
    if (!(await checkIfClean({ cwd: this.cwd }))) {
      await this.ensureGitUser()
      await commitAll(message, { cwd: this.cwd })
    }
    await push(branch, {
      cwd: this.cwd,
      env: {
        ...process.env,
        ...(await this.#getCliAuthEnv()),
      } as Record<string, string>,
    })
  }

  // Make the `GITLAB_TOKEN` authoritative for Git CLI operations without
  // changing the repository config. GitLab CI embeds a `gitlab-ci-token` in the
  // `origin` URL, so install command-scoped `http.extraHeader` overrides for
  // every push destination. libcurl ignores the URL userinfo once an
  // `Authorization` header is supplied, so this replaces the job token.
  async #getCliAuthEnv(): Promise<Record<string, string>> {
    const username =
      env.GITLAB_TOKEN_TYPE === 'oauth' ? 'oauth2' : await getUsername(this.api)
    const basic = Buffer.from(`${username}:${this.#gitlabToken}`).toString(
      'base64',
    )

    // The environment may already contain command-scoped Git config. Append
    // our KEY_n/VALUE_n entries so those existing settings stay active.
    const gitConfigCount = Number(process.env.GIT_CONFIG_COUNT ?? 0)
    if (!Number.isInteger(gitConfigCount) || gitConfigCount < 0) {
      throw new Error(
        `Invalid GIT_CONFIG_COUNT value: ${process.env.GIT_CONFIG_COUNT}`,
      )
    }

    // `git push origin` prefers remote.origin.pushurl over the fetch URL and
    // supports more than one push URL, so inspect every effective destination.
    const { stdout } = await getExecOutput(
      'git',
      ['remote', 'get-url', '--push', '--all', 'origin'],
      {
        cwd: this.cwd,
        ignoreReturnCode: true,
        // A user-configured remote can contain credentials. Only echo it when
        // `DEBUG_GITLAB_CREDENTIAL` is explicitly enabled.
        silent: !TRUTHY_VALUES.has(env.DEBUG_GITLAB_CREDENTIAL!),
      },
    )

    // Git reads `http.extraHeader` from the most specific matching URL section.
    // The host key replaces any persisted header; an exact key for each
    // destination outranks path- or username-specific inherited config.
    const extraHeaderKeys = new Set([`http.${this.serverUrl}/.extraheader`])
    for (const remoteUrl of stdout.split(/\r?\n/)) {
      const httpUrl = getHttpUrl(remoteUrl)
      if (httpUrl !== undefined) {
        extraHeaderKeys.add(`http.${httpUrl}.extraheader`)
      }
    }
    const authHeader = `AUTHORIZATION: basic ${basic}`

    // Each URL key needs two new command-scoped config entries: one to reset
    // the inherited header list and one to install our Authorization header.
    const authEnv: Record<string, string> = {
      GIT_CONFIG_COUNT: String(gitConfigCount + extraHeaderKeys.size * 2),
    }

    // `http.extraHeader` is multi-valued, so merely appending our header could
    // make Git send both tokens. An empty value resets inherited values; the
    // following value adds only ours.
    let index = 0
    for (const extraHeaderKey of extraHeaderKeys) {
      const resetIndex = gitConfigCount + index * 2
      const authIndex = resetIndex + 1
      authEnv[`GIT_CONFIG_KEY_${resetIndex}`] = extraHeaderKey
      authEnv[`GIT_CONFIG_VALUE_${resetIndex}`] = ''
      authEnv[`GIT_CONFIG_KEY_${authIndex}`] = extraHeaderKey
      authEnv[`GIT_CONFIG_VALUE_${authIndex}`] = authHeader
      index++
    }

    return authEnv
  }
}
