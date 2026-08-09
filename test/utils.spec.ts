import path from 'node:path'

import { getAllFiles, getCwdInput } from '../src/utils.js'

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
})
