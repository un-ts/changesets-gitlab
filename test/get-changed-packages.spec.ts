import { isFileInPackageDirectory } from '../src/get-changed-packages.js'

describe('isFileInPackageDirectory', () => {
  test('matches files within the package directory', () => {
    expect(
      isFileInPackageDirectory(
        'packages/ui-kit/src/index.ts',
        'packages/ui-kit',
      ),
    ).toBe(true)
  })

  test('does not match sibling packages with the same prefix', () => {
    expect(
      isFileInPackageDirectory(
        'packages/ui-kit-storybook/src/index.ts',
        'packages/ui-kit',
      ),
    ).toBe(false)
  })
})
