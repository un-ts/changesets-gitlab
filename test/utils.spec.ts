import { getAllFiles } from '../src/utils'

describe('utils', () => {
  test('getAllFiles', async () => {
    expect(await getAllFiles('test/fixtures')).toMatchSnapshot()
  })
})
