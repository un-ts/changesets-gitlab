import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import * as core from '@actions/core'

import type { GitLabApi } from '../src/api.js'
import type { GitLab } from '../src/gitlab.js'
import { runPublish, runVersion } from '../src/run.js'
import { commitChangesSinceBase } from '../src/utils.js'

vi.hoisted(() => {
  process.env.CI_PROJECT_ID = '1'
  process.env.CI_COMMIT_REF_NAME = 'main'
})

vi.mock('@actions/core', async importOriginal => ({
  ...(await importOriginal<typeof import('@actions/core')>()),
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))

const dirs: string[] = []

function createRepo(files: Record<string, string> = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'changesets-gitlab-run-'))
  dirs.push(cwd)

  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(cwd, name)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content)
  }

  const git = (...args: string[]) =>
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    execFileSync('git', args, { cwd, stdio: 'pipe' })

  git('init', '-b', 'main')
  git('config', 'user.email', 'x@y.z')
  git('config', 'user.name', 'xyz')
  git('config', 'commit.gpgsign', 'false')
  git('config', 'tag.gpgsign', 'false')
  git('add', '-A')
  git('commit', '-m', 'initial', '--allow-empty')

  return cwd
}

afterEach(() => {
  for (const dir of dirs) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  dirs.length = 0
})

const createMergeRequests = () => ({
  all: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({ iid: 1 }),
  edit: vi.fn().mockResolvedValue({ iid: 1 }),
})

const createGitLab = (
  cwd: string,
  overrides: Record<string, unknown> = {},
  api: Record<string, unknown> = {},
) =>
  ({
    cwd,
    pushWithGitCli: true,
    api: {
      FeatureFlags: {
        show: vi.fn().mockRejectedValue(new Error('not available')),
      },
      MergeRequests: createMergeRequests(),
      ProjectReleases: { create: vi.fn().mockResolvedValue({}) },
      ...api,
    },
    ensureGitUser: vi.fn(),
    prepareBranch: vi.fn(),
    pushChanges: vi.fn(),
    pushTag: vi.fn(),
    pushTags: vi.fn(),
    ...overrides,
  }) as unknown as GitLab

const simpleProject = {
  'package.json': JSON.stringify({
    name: 'pkg',
    version: '1.0.0',
    private: true,
  }),
  'CHANGELOG.md': '# pkg\n\n## 1.0.0\n\n### Minor Changes\n\n- Initial\n',
  '.changeset/config.json': '{}',
}

describe('commitChangesSinceBase', () => {
  test('sends create/update/delete actions since the base commit', async () => {
    const cwd = createRepo({ 'a.txt': 'a\n', 'b.txt': 'b\n' })
    fs.appendFileSync(path.join(cwd, 'a.txt'), 'changed\n')
    fs.rmSync(path.join(cwd, 'b.txt'))
    fs.writeFileSync(path.join(cwd, 'c.txt'), 'new\n')

    const create = vi.fn().mockResolvedValue({})
    await commitChangesSinceBase({
      api: { Commits: { create } } as unknown as GitLabApi,
      projectId: '1',
      branch: 'changeset-release/main',
      message: 'Version Packages',
      base: { commit: 'HEAD' },
      force: true,
      cwd,
    })

    expect(create).toHaveBeenCalledOnce()
    const call = create.mock.calls[0]
    expect(call[0]).toBe('1')
    expect(call[1]).toBe('changeset-release/main')
    expect(call[2]).toBe('Version Packages')
    expect(call[4]).toEqual({ startSha: 'HEAD', force: true })
    expect(call[3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'update',
          filePath: 'a.txt',
          encoding: 'base64',
        }),
        expect.objectContaining({ action: 'delete', filePath: 'b.txt' }),
        expect.objectContaining({
          action: 'create',
          filePath: 'c.txt',
          encoding: 'base64',
        }),
      ]),
    )
  })

  test('does not create a commit when nothing changed', async () => {
    const cwd = createRepo()
    const create = vi.fn()
    await commitChangesSinceBase({
      api: { Commits: { create } } as unknown as GitLabApi,
      projectId: '1',
      branch: 'changeset-release/main',
      message: 'Version Packages',
      base: { commit: 'HEAD' },
      force: true,
      cwd,
    })
    expect(create).not.toHaveBeenCalled()
  })
})

describe('runPublish', () => {
  test('warns when a custom publish script does not create the output file', async () => {
    const cwd = createRepo(simpleProject)
    const result = await runPublish({
      script: 'node -e "void 0"',
      gitlab: createGitLab(cwd),
      createGitlabReleases: true,
      pushGitTags: true,
      cwd,
    })

    expect(result).toEqual({ published: false, exitCode: 0 })
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining(
        'GitLab releases and git tags cannot be created without this output',
      ),
    )
  })

  test('publishes the packages reported through CHANGESETS_OUTPUT', async () => {
    const cwd = createRepo({
      ...simpleProject,
      'publish.js': `require('node:fs').writeFileSync(process.env.CHANGESETS_OUTPUT, JSON.stringify({ type: 'git-tag', tag: 'pkg@1.1.0', packageName: 'pkg' }) + '\\n')\n`,
    })

    const pushTags = vi.fn()
    const create = vi.fn().mockResolvedValue({})
    const result = await runPublish({
      script: 'node publish.js',
      gitlab: createGitLab(cwd, { pushTags }, { ProjectReleases: { create } }),
      createGitlabReleases: true,
      pushGitTags: true,
      cwd,
    })

    expect(result).toEqual({
      published: true,
      publishedPackages: [{ name: 'pkg', version: '1.0.0' }],
      exitCode: 0,
    })
    expect(pushTags).toHaveBeenCalledOnce()
    expect(create).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ tag_name: 'pkg@1.1.0' }),
    )
  })
})

describe('runVersion', () => {
  test('skips the merge request when the version command bumped nothing', async () => {
    const cwd = createRepo(simpleProject)
    const mergeRequests = createMergeRequests()
    const result = await runVersion({
      script: 'node -e "void 0"',
      gitlab: createGitLab(cwd, {}, { MergeRequests: mergeRequests }),
      cwd,
    })

    expect(result).toEqual({})
    expect(mergeRequests.all).not.toHaveBeenCalled()
  })

  test('creates a merge request for bumped packages', async () => {
    const cwd = createRepo({
      ...simpleProject,
      'version.js': `const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '1.1.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2))
fs.writeFileSync('CHANGELOG.md', '## 1.1.0\\n\\n### Minor Changes\\n\\n- Awesome feature\\n')
`,
    })

    const mergeRequests = createMergeRequests()
    const result = await runVersion({
      script: 'node version.js',
      gitlab: createGitLab(cwd, {}, { MergeRequests: mergeRequests }),
      cwd,
    })

    expect(result).toEqual({ pullRequestNumber: 1 })
    expect(mergeRequests.create).toHaveBeenCalledOnce()
    const call = mergeRequests.create.mock.calls[0]
    expect(call[0]).toBe('1')
    expect(call[1]).toBe('changeset-release/main')
    expect(call[2]).toBe('main')
    expect(call[3]).toBe('Version Packages')
  })
})
