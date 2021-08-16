import { getAllFiles } from '../src/utils'

test('utils', async () => {
  expect(await getAllFiles('test/fixtures')).toMatchSnapshot()
})
