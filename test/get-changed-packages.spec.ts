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
    JSON.stringify({
      name: '@example/ui-kit-storybook',
      version: '1.0.0',
      private: true,
    }),
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
  const mockFiles = (overrides: Record<string, string>) => {
    const overridden = new Map(files)
    for (const [file, contents] of Object.entries(overrides)) {
      overridden.set(file, contents)
    }
    mocks.readFile.mockImplementation((path: string) => {
      const contents = overridden.get(path)
      if (contents === undefined) {
        throw new Error(`Unexpected path: ${path}`)
      }
      return Promise.resolve(contents)
    })
  }

  test('does not match sibling packages with the same prefix', async () => {
    const result = await getChangedPackages({
      changedFiles: ['packages/ui-kit-storybook/src/index.ts'],
    })

    expect(result.changedPackages).toEqual([])
  })

  test('matches files within the package directory', async () => {
    const result = await getChangedPackages({
      changedFiles: ['packages/ui-kit/src/index.ts'],
    })

    expect(result.changedPackages).toEqual(['@example/ui-kit'])
  })

  test('falls back to the root package when pnpm-workspace.yaml has no packages field', async () => {
    mockFiles({
      'package.json': JSON.stringify({
        name: 'root-package',
        version: '1.0.0',
      }),
      'pnpm-workspace.yaml': 'onlyBuiltDependencies:\n  - esbuild\n',
    })

    const result = await getChangedPackages({
      changedFiles: ['src/index.ts'],
    })

    expect(result.changedPackages).toEqual(['root-package'])
  })

  test('skips packages without a version', async () => {
    mockFiles({
      'package.json': JSON.stringify({ name: 'versionless-package' }),
      'pnpm-workspace.yaml': 'onlyBuiltDependencies:\n  - esbuild\n',
    })

    const result = await getChangedPackages({
      changedFiles: ['src/index.ts'],
    })

    expect(result.changedPackages).toEqual([])
  })

  test('includes private packages when privatePackages.version is enabled', async () => {
    mockFiles({
      '.changeset/config.json': JSON.stringify({
        ...JSON.parse(files.get('.changeset/config.json')!),
        privatePackages: { version: true, tag: false },
      }),
    })

    const result = await getChangedPackages({
      changedFiles: ['packages/ui-kit-storybook/src/index.ts'],
    })

    expect(result.changedPackages).toEqual(['@example/ui-kit-storybook'])
  })

  test('uses the private root package when pnpm workspace omits packages and private versioning is enabled', async () => {
    mockFiles({
      '.changeset/config.json': JSON.stringify({
        ...JSON.parse(files.get('.changeset/config.json')!),
        privatePackages: { version: true, tag: false },
      }),
      'package.json': JSON.stringify({
        name: 'yourpackagename',
        version: '1.0.0',
        private: true,
      }),
      'pnpm-workspace.yaml': 'onlyBuiltDependencies:\n  - esbuild\n',
    })

    const result = await getChangedPackages({
      changedFiles: ['src/index.ts'],
    })

    expect(result.changedPackages).toEqual(['yourpackagename'])
  })
})
