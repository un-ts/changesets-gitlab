import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
  vi.resetModules()
})

function createRepo() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'changesets-gitlab-git-'))
  const git = (...args: string[]) =>
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    execFileSync('git', args, { cwd, stdio: 'pipe' })
  git('init', '-b', 'main')
  git('remote', 'add', 'origin', 'https://gitlab.example.com/group/proj.git')
  return cwd
}

describe('GitLab.getCliAuthEnv', () => {
  test('installs a command-scoped Authorization header for the GitLab host', async () => {
    const cwd = createRepo()
    process.env.GITLAB_HOST = 'https://gitlab.example.com'
    process.env.GITLAB_TOKEN = 'glpat-token'
    process.env.GITLAB_CI_USER_NAME = 'bot'
    process.env.CI_PROJECT_ID = '1'
    vi.resetModules()

    try {
      const { GitLab } = await import('../src/gitlab.js')
      const gitlab = new GitLab({ gitlabToken: 'glpat-token', cwd })

      const result = await gitlab.getCliAuthEnv()

      expect(result.GIT_CONFIG_COUNT).toBe('4')
      const values = Object.entries(result)
      const authValues = values
        .filter(([key]) => key.startsWith('GIT_CONFIG_VALUE_'))
        .map(([, value]) => value)
      const expectedHeader = `AUTHORIZATION: basic ${Buffer.from(
        'bot:glpat-token',
      ).toString('base64')}`
      expect(authValues.filter(value => value === expectedHeader)).toHaveLength(
        2,
      )
      expect(
        values.filter(
          ([key, value]) =>
            key.startsWith('GIT_CONFIG_KEY_') &&
            value === 'http.https://gitlab.example.com/.extraheader',
        ),
      ).toHaveLength(2)
      expect(
        values.filter(
          ([key, value]) =>
            key.startsWith('GIT_CONFIG_KEY_') &&
            value ===
              'http.https://gitlab.example.com/group/proj.git.extraheader',
        ),
      ).toHaveLength(2)
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true })
    }
  })
})
