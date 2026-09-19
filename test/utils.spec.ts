import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  BumpLevels,
  getAllFiles,
  getBooleanInput,
  getChangelogEntry,
  getCwdInput,
  resolveChangesetsCliFile,
  setOutput,
  throwOnRemovedCommitModeInput,
  throwOnRenamedInputs,
} from '../src/utils.js'

const { globalPackagesDir, tmpBase } = vi.hoisted(() => {
  const tmpBase = `${process.cwd()}/.tmp-changesets-gitlab-resolve`
  return { globalPackagesDir: `${tmpBase}/global/node_modules`, tmpBase }
})

vi.mock('global-directory', () => ({
  default: {
    npm: { packages: globalPackagesDir },
    yarn: { packages: globalPackagesDir },
    pnpm: { packages: globalPackagesDir },
  },
}))

beforeAll(() => {
  fs.mkdirSync(path.join(globalPackagesDir, '@changesets/cli'), {
    recursive: true,
  })
  fs.writeFileSync(
    path.join(globalPackagesDir, '@changesets/cli/package.json'),
    JSON.stringify({ name: '@changesets/cli', version: '3.0.0' }),
  )
  fs.writeFileSync(path.join(globalPackagesDir, '@changesets/cli/bin.js'), '')
})

afterAll(() => {
  fs.rmSync(tmpBase, { recursive: true, force: true })
})

describe('utils', () => {
  test('getAllFiles', async () => {
    expect(await getAllFiles('test/fixtures')).toMatchSnapshot()
  })

  test('getAllFiles with empty string', async () => {
    const files = await getAllFiles('')
    // Should treat empty string as cwd and not throw
    expect(Array.isArray(files)).toBe(true)
    expect(files.length).toBeGreaterThan(0)
  })

  describe('getChangelogEntry', () => {
    const changelog = `# pkg

## 3.0.1

### Patch Changes

- Fixed a thing

## 3.0.0

### Major Changes

- Broke a thing
`

    test('returns the raw entry for the requested version', () => {
      expect(getChangelogEntry(changelog, '3.0.1')).toEqual({
        content: '### Patch Changes\n\n- Fixed a thing',
        highestLevel: BumpLevels.patch,
      })
      expect(getChangelogEntry(changelog, '3.0.0')).toEqual({
        content: '### Major Changes\n\n- Broke a thing',
        highestLevel: BumpLevels.major,
      })
    })

    test('ignores headings inside code fences', () => {
      const withCodeFence = `## 1.0.0

\`\`\`md
## 1.0.0
\`\`\`

- Released
`
      const entry = getChangelogEntry(withCodeFence, '1.0.0')
      expect(entry.content).toContain('- Released')
      expect(entry.content).toContain('## 1.0.0')
    })

    test('ignores headings inside tilde fences', () => {
      const withTildeFence = `## 1.0.0

~~~md
## 1.0.0
~~~

- Released
`
      const entry = getChangelogEntry(withTildeFence, '1.0.0')
      expect(entry.content).toContain('- Released')
      expect(entry.content).toContain('## 1.0.0')
    })
  })

  describe('getCwdInput', () => {
    const CWD = process.cwd()

    afterEach(() => {
      delete process.env.INPUT_CWD
    })

    test('returns cwd when no input set', () => {
      expect(getCwdInput()).toEqual({ relative: '', absolute: CWD })
    })

    test('returns relative and absolute for valid subdirectory', () => {
      process.env.INPUT_CWD = 'src'
      expect(getCwdInput()).toEqual({
        relative: 'src',
        absolute: path.join(CWD, 'src'),
      })
    })

    test('throws for parent directory traversal', () => {
      process.env.INPUT_CWD = '..'
      expect(() => getCwdInput()).toThrow('Invalid cwd input')
    })

    test('throws for path with ../', () => {
      process.env.INPUT_CWD = 'foo/../../bar'
      expect(() => getCwdInput()).toThrow('Invalid cwd input')
    })
  })

  describe('throwOnRemovedCommitModeInput', () => {
    afterEach(() => {
      delete process.env.INPUT_COMMIT_MODE
      delete process.env.INPUT_COMMITMODE
    })

    test('does not throw when unset', () => {
      expect(() => throwOnRemovedCommitModeInput()).not.toThrow()
    })

    test('throws with the normalized kebab-case input', () => {
      process.env.INPUT_COMMIT_MODE = 'git-cli'
      expect(() => throwOnRemovedCommitModeInput()).toThrow(
        'The "INPUT_COMMIT_MODE" environment variable has been replaced by "INPUT_PUSH_WITH_GIT_CLI"',
      )
    })

    test('throws with camelCase input', () => {
      process.env.INPUT_COMMITMODE = 'gitlab-api'
      expect(() => throwOnRemovedCommitModeInput()).toThrow(
        'The "INPUT_COMMITMODE" environment variable has been replaced by "INPUT_PUSH_WITH_GIT_CLI"',
      )
    })
  })

  describe('getBooleanInput', () => {
    afterEach(() => {
      delete process.env.INPUT_PUSH_WITH_GIT_CLI
    })

    test('returns the default when unset', () => {
      expect(getBooleanInput('push-with-git-cli', true)).toBe(true)
      expect(getBooleanInput('push-with-git-cli')).toBe(false)
    })

    test('accepts the YAML boolean spellings and GitLab-style 1/0', () => {
      for (const value of ['true', 'True', 'TRUE', '1']) {
        process.env.INPUT_PUSH_WITH_GIT_CLI = value
        expect(getBooleanInput('push-with-git-cli')).toBe(true)
      }
      for (const value of ['false', 'False', 'FALSE', '0']) {
        process.env.INPUT_PUSH_WITH_GIT_CLI = value
        expect(getBooleanInput('push-with-git-cli', true)).toBe(false)
      }
    })

    test('is case-sensitive', () => {
      process.env.INPUT_PUSH_WITH_GIT_CLI = 'tRuE'
      expect(() => getBooleanInput('push-with-git-cli')).toThrow()
    })

    test('throws on invalid values', () => {
      process.env.INPUT_PUSH_WITH_GIT_CLI = 'yes'
      expect(() => getBooleanInput('push-with-git-cli')).toThrow()
    })
  })

  describe('setOutput', () => {
    let home: string
    let originalHome: string | undefined
    let originalGithubOutput: string | undefined

    beforeEach(() => {
      originalHome = process.env.HOME
      originalGithubOutput = process.env.GITHUB_OUTPUT
      delete process.env.GITHUB_OUTPUT
      home = fs.mkdtempSync(path.join(os.tmpdir(), 'changesets-env-'))
      process.env.HOME = home
    })

    afterEach(() => {
      if (originalHome === undefined) {
        delete process.env.HOME
      } else {
        process.env.HOME = originalHome
      }
      if (originalGithubOutput === undefined) {
        delete process.env.GITHUB_OUTPUT
      } else {
        process.env.GITHUB_OUTPUT = originalGithubOutput
      }
      fs.rmSync(home, { recursive: true, force: true })
    })

    test('writes the GITHUB_OUTPUT fallback file', () => {
      setOutput('published-packages', [{ name: '@xx/xx', version: '1.2.0' }])
      const outputsFile = path.join(home, '.changesets-gitlab.outputs')
      expect(process.env.GITHUB_OUTPUT).toBe(outputsFile)
      const outputs = fs.readFileSync(outputsFile, 'utf8')
      expect(outputs).toContain('published-packages<<ghadelimiter_')
      expect(outputs).toContain('[{"name":"@xx/xx","version":"1.2.0"}]')
    })

    test('appends further outputs to the same file', () => {
      setOutput('has-changesets', true)
      setOutput('pr-number', '42')
      const outputs = fs.readFileSync(
        path.join(home, '.changesets-gitlab.outputs'),
        'utf8',
      )
      expect(outputs).toContain('has-changesets<<ghadelimiter_')
      expect(outputs).toContain('pr-number<<ghadelimiter_')
    })

    test('opts out when GITHUB_OUTPUT is explicitly empty', () => {
      process.env.GITHUB_OUTPUT = ''
      setOutput('has-changesets', true)
      expect(fs.existsSync(path.join(home, '.changesets-gitlab.outputs'))).toBe(
        false,
      )
      expect(process.env.GITHUB_OUTPUT).toBe('')
    })
  })

  describe('throwOnRenamedInputs', () => {
    afterEach(() => {
      delete process.env.INPUT_PUBLISH
    })

    test('does not throw when no old input is set', () => {
      expect(() =>
        throwOnRenamedInputs({ publish: 'publish-script' }),
      ).not.toThrow()
    })

    test('throws and lists the replacement when an old input is set', () => {
      process.env.INPUT_PUBLISH = 'yarn release'
      expect(() => throwOnRenamedInputs({ publish: 'publish-script' })).toThrow(
        '- "INPUT_PUBLISH" -> "INPUT_PUBLISH_SCRIPT"',
      )
    })
  })

  describe('resolveChangesetsCliFile', () => {
    test('prefers a repository-local `@changesets/cli`', () => {
      const cwd = path.join(tmpBase, 'cwd-with-cli')
      const cliDir = path.join(cwd, 'node_modules/@changesets/cli')
      fs.mkdirSync(cliDir, { recursive: true })
      fs.writeFileSync(path.join(cliDir, 'bin.js'), '')

      expect(resolveChangesetsCliFile('@changesets/cli/bin.js', cwd)).toBe(
        path.join(cliDir, 'bin.js'),
      )
    })

    test('falls back to the globally installed `@changesets/cli`', () => {
      // Use a cwd outside the repository so the lookup cannot walk up into
      // the repository's own `node_modules`.
      const cwd = fs.mkdtempSync(
        path.join(os.tmpdir(), 'changesets-gitlab-cwd-'),
      )
      try {
        expect(resolveChangesetsCliFile('@changesets/cli/bin.js', cwd)).toBe(
          path.join(globalPackagesDir, '@changesets/cli/bin.js'),
        )
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true })
      }
    })
  })
})
