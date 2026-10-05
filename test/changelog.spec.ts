import type {
  ModCompWithPackage,
  NewChangesetWithCommit,
} from '@changesets/types'
import { GitbeakerRequestError } from '@gitbeaker/rest'

const SERVER_URL = 'https://gitlab.example.com'
const REPO = 'group/project'
const COMMIT_SHA = 'abcdef1234567890'
const MR_IID = 123

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    Commits: {
      show: vi.fn(),
      allMergeRequests: vi.fn(),
    },
    MergeRequests: {
      show: vi.fn(),
    },
  },
}))

vi.mock('../src/api.ts', () => ({
  createApi: () => mockApi,
}))

const changelogModule = await import('../src/changelog/index.js')
const changelog = changelogModule.default

const commitUrl = `${SERVER_URL}/${REPO}/-/commit/${COMMIT_SHA}`
const mrUrl = `${SERVER_URL}/${REPO}/-/merge_requests/${MR_IID}`
const userUrl = `${SERVER_URL}/octocat`

const mergeRequest = {
  iid: MR_IID,
  web_url: mrUrl,
  author: {
    username: 'octocat',
    name: 'Octo Cat',
    web_url: userUrl,
  },
  merge_commit_sha: COMMIT_SHA,
  squash_commit_sha: null,
  merged_at: '2024-01-01T00:00:00.000Z',
}

const commit = {
  id: COMMIT_SHA,
  short_id: 'abcdef1',
  web_url: commitUrl,
}

const createChangeset = (
  overrides: Partial<NewChangesetWithCommit> = {},
): NewChangesetWithCommit => ({
  id: 'changeset-id',
  summary: 'fix the thing',
  releases: [{ name: 'pkg', type: 'patch' }],
  commit: COMMIT_SHA,
  ...overrides,
})

const notFoundError = () =>
  new GitbeakerRequestError('404 Not Found', {
    cause: {
      description: '404 Not Found',
      request: new Request(`${SERVER_URL}/api/v4/projects/1`),
      response: new Response(null, { status: 404 }),
    },
  })

const originalEnv = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GITLAB_TOKEN = 'glpat-token'
  process.env.GITLAB_HOST = SERVER_URL
  process.env.CI_PROJECT_PATH = REPO

  mockApi.Commits.show.mockResolvedValue(commit)
  mockApi.Commits.allMergeRequests.mockResolvedValue([mergeRequest])
  mockApi.MergeRequests.show.mockResolvedValue(mergeRequest)
})

afterAll(() => {
  process.env = { ...originalEnv }
})

describe('changelog', () => {
  test('links the commit, its merge request and author by default', async () => {
    const line = await changelog.getReleaseLine(createChangeset(), 'patch', {
      repo: REPO,
    })

    expect(line).toBe(
      `\n\n- [!123](${mrUrl}) [\`abcdef1\`](${commitUrl}) Thanks [@octocat](${userUrl})! - fix the thing\n`,
    )
  })

  test('falls back to the commit when there is no merge request', async () => {
    mockApi.Commits.allMergeRequests.mockResolvedValue([])

    const line = await changelog.getReleaseLine(createChangeset(), 'patch', {
      repo: REPO,
    })

    expect(line).toBe(`\n\n- [\`abcdef1\`](${commitUrl}) - fix the thing\n`)
  })

  test('linkifies issue and merge request references', async () => {
    const line = await changelog.getReleaseLine(
      createChangeset({ summary: 'fix the thing #42\n\nFixes #43 and !44' }),
      'patch',
      { repo: REPO },
    )

    expect(line).toContain(`[#42](${SERVER_URL}/${REPO}/-/issues/42)`)
    expect(line).toContain(
      `  Fixes [#43](${SERVER_URL}/${REPO}/-/issues/43) and [!44](${SERVER_URL}/${REPO}/-/merge_requests/44)`,
    )
  })

  test('reads the merge request from the summary instead of the commit', async () => {
    const line = await changelog.getReleaseLine(
      createChangeset({ commit: undefined, summary: 'mr: 123\nfix the thing' }),
      'patch',
      { repo: REPO },
    )

    expect(mockApi.MergeRequests.show).toHaveBeenCalledWith(REPO, MR_IID)
    expect(mockApi.Commits.show).not.toHaveBeenCalled()
    expect(line).toContain(`[!123](${mrUrl})`)
  })

  test('prefers an explicit commit in the summary', async () => {
    const line = await changelog.getReleaseLine(
      createChangeset({
        commit: undefined,
        summary: 'mr: 123\ncommit: deadbeef\nfix the thing',
      }),
      'patch',
      { repo: REPO },
    )

    expect(line).toContain(
      `[\`deadbee\`](${SERVER_URL}/${REPO}/-/commit/deadbeef)`,
    )
  })

  test('links authors from the summary and honors disableThanks', async () => {
    const line = await changelog.getReleaseLine(
      createChangeset({ commit: undefined, summary: 'author: @alice\nfix it' }),
      'patch',
      { repo: REPO },
    )
    expect(line).toContain(`Thanks [@alice](${SERVER_URL}/alice)!`)

    const withoutThanks = await changelog.getReleaseLine(
      createChangeset({ commit: undefined, summary: 'author: @alice\nfix it' }),
      'patch',
      { repo: REPO, disableThanks: true },
    )
    expect(withoutThanks).not.toContain('Thanks')
  })

  test('renders a custom template', async () => {
    const line = await changelog.getReleaseLine(createChangeset(), 'patch', {
      repo: REPO,
      template: '\n\n- {summary} {ref}',
    })

    expect(line).toBe(`\n\n- fix the thing ([!123](${mrUrl}))\n`)
  })

  test('rejects unknown template tokens', async () => {
    await expect(
      changelog.getReleaseLine(createChangeset(), 'patch', {
        repo: REPO,
        template: '{unknown}',
      }),
    ).rejects.toThrow('Unknown changelog template token')
  })

  test('requires a repo', async () => {
    delete process.env.CI_PROJECT_PATH

    await expect(
      changelog.getReleaseLine(createChangeset(), 'patch', {}),
    ).rejects.toThrow('Please provide a repo')
  })

  test('requires a token when fetching information', async () => {
    delete process.env.GITLAB_TOKEN

    await expect(
      changelog.getReleaseLine(createChangeset(), 'patch', { repo: REPO }),
    ).rejects.toThrow('GITLAB_TOKEN')
  })

  test('ignores missing commits instead of failing', async () => {
    mockApi.Commits.show.mockRejectedValue(notFoundError())

    const line = await changelog.getReleaseLine(createChangeset(), 'patch', {
      repo: REPO,
    })

    expect(line).toBe('\n\n- fix the thing\n')
  })

  test('builds dependency release lines', async () => {
    const dependenciesUpdated = [
      { name: 'dep', newVersion: '1.2.3' },
    ] as ModCompWithPackage[]

    const line = await changelog.getDependencyReleaseLine(
      [createChangeset()],
      dependenciesUpdated,
      { repo: REPO },
    )

    expect(line).toBe(
      `- Updated dependencies [[\`abcdef1\`](${commitUrl})]:\n  - dep@1.2.3`,
    )
  })

  test('returns an empty dependency release line when nothing changed', async () => {
    expect(
      await changelog.getDependencyReleaseLine([createChangeset()], [], {
        repo: REPO,
      }),
    ).toBe('')
  })
})
