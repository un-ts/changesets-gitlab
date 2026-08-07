const mocks = {
  readFile: vi.fn(),
  getAllFiles: vi.fn(),
}

vi.doMock('node:fs/promises', () => ({ default: { readFile: mocks.readFile } }))
vi.doMock('../src/utils.js', () => ({ getAllFiles: mocks.getAllFiles }))

const { getChangedPackages } = await import('../src/get-changed-packages.js')

const files = new Map([
  ['package.json', JSON.stringify({ private: true })],
  [
    '.changeset/config.json',
    JSON.stringify({
      changelog: false,
      commit: false,
      fixed: [],
      linked: [],
      access: 'restricted',
      baseBranch: 'main',
      updateInternalDependencies: 'patch',
      bumpVersionsWithWorkspaceProtocolOnly: false,
      ignore: [],
    }),
  ],
  ['pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n"],
  [
    'packages/ui-kit/package.json',
    JSON.stringify({ name: '@example/ui-kit', version: '1.0.0' }),
  ],
  [
    'packages/ui-kit-storybook/package.json',
    JSON.stringify({ name: '@example/ui-kit-storybook', private: true }),
  ],
])

beforeEach(() => {
  mocks.getAllFiles.mockResolvedValue([
    'package.json',
    '.changeset/config.json',
    'pnpm-workspace.yaml',
    'packages/ui-kit/package.json',
    'packages/ui-kit-storybook/package.json',
  ])
  mocks.readFile.mockImplementation((path: string) => {
    const contents = files.get(path)
    if (contents === undefined) {
      throw new Error(`Unexpected path: ${path}`)
    }
    return Promise.resolve(contents)
  })
})

describe('getChangedPackages', () => {
  test('does not match sibling packages with the same prefix', async () => {
    const result = await getChangedPackages({
      changedFiles: ['packages/ui-kit-storybook/src/index.ts'],
      api: undefined as never,
    })

    expect(result.changedPackages).toEqual([])
  })

  test('matches files within the package directory', async () => {
    const result = await getChangedPackages({
      changedFiles: ['packages/ui-kit/src/index.ts'],
      api: undefined as never,
    })

    expect(result.changedPackages).toEqual(['@example/ui-kit'])
  })
})
