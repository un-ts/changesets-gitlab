import { env } from '../env.ts'

export interface ChangelogOptions {
  disableThanks: boolean
  template?: string
}

export interface ChangelogConfig {
  repo: string
  serverUrl: string
}

export interface ChangelogEnv {
  repo?: string
  serverUrl: string
  token?: string
}

// GitLab CI predefines `CI_SERVER_URL` and `CI_PROJECT_PATH`; `GITLAB_HOST`
// and `GITLAB_TOKEN` are this tool's own overrides. Reuse the CLI's host
// resolution so `.env`/`GITLAB_HOST`/`CI_SERVER_URL` are handled in one place;
// `env.GITLAB_TOKEN` is avoided because its getter calls `core.setFailed`.
export const readEnv = (): ChangelogEnv => ({
  repo: process.env.CI_PROJECT_PATH,
  serverUrl: env.GITLAB_HOST.replace(/\/$/, ''),
  token: process.env.GITLAB_TOKEN,
})

export const parseOptions = (
  options: Record<string, unknown> | null,
): ChangelogOptions => {
  const record = options ?? {}
  return {
    disableThanks: Boolean(record.disableThanks),
    template:
      typeof record.template === 'string' && record.template
        ? record.template
        : undefined,
  }
}

// Mirrors `getRepo` in `@changesets/changelog-github`: an explicit `repo`
// option wins (even when empty), otherwise fall back to the env variable.
export const getRepo = (
  options: Record<string, unknown> | null,
  changelogEnv: ChangelogEnv,
) => {
  let repo: string | undefined
  if (options && 'repo' in options) {
    repo =
      typeof options.repo === 'string' && options.repo
        ? options.repo
        : undefined
  } else {
    repo = changelogEnv.repo
  }
  if (!repo) {
    throw new Error(
      'Please provide a repo to this changelog generator like this:\n' +
        '"changelog": ["changesets-gitlab/changelog", { "repo": "group/project" }]\n' +
        'or set the CI_PROJECT_PATH environment variable.',
    )
  }
  return repo
}

export const resolveConfig = (
  options: Record<string, unknown> | null,
  changelogEnv: ChangelogEnv,
): ChangelogConfig => ({
  repo: getRepo(options, changelogEnv),
  serverUrl: changelogEnv.serverUrl,
})
