export interface ChangelogOptions {
  repo?: string
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

const DEFAULT_SERVER_URL = 'https://gitlab.com'

// GitLab CI predefines `CI_SERVER_URL` and `CI_PROJECT_PATH`; `GITLAB_HOST`
// and `GITLAB_TOKEN` are this tool's own overrides.
export const readEnv = (): ChangelogEnv => ({
  repo: process.env.CI_PROJECT_PATH,
  serverUrl: (
    process.env.GITLAB_HOST ??
    process.env.CI_SERVER_URL ??
    DEFAULT_SERVER_URL
  ).replace(/\/$/, ''),
  token: process.env.GITLAB_TOKEN,
})

export const parseOptions = (
  options: Record<string, unknown> | null,
): ChangelogOptions => {
  const record = options ?? {}
  return {
    repo:
      typeof record.repo === 'string' && record.repo ? record.repo : undefined,
    disableThanks: record.disableThanks === true,
    template:
      typeof record.template === 'string' && record.template
        ? record.template
        : undefined,
  }
}

export const resolveConfig = (
  options: ChangelogOptions,
  env: ChangelogEnv,
): ChangelogConfig => {
  const repo = options.repo || env.repo
  if (!repo) {
    throw new Error(
      'Please provide a repo to this changelog generator like this:\n' +
        '"changelog": ["changesets-gitlab/changelog", { "repo": "group/project" }]\n' +
        'or set the CI_PROJECT_PATH environment variable.',
    )
  }
  return { repo, serverUrl: env.serverUrl }
}
