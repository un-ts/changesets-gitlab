import { PreState, NewChangeset } from '@changesets/types'
import { readPreState } from '@changesets/pre'
import _readChangesets from '@changesets/read'

export interface ChangesetState {
  preState: PreState | undefined
  changesets: NewChangeset[]
}

// @ts-expect-error - workaround for https://github.com/atlassian/changesets/issues/622
const readChangesets = (_readChangesets.default ||
  _readChangesets) as typeof _readChangesets

export default async function readChangesetState(
  cwd: string = process.cwd(),
): Promise<ChangesetState> {
  const preState = await readPreState(cwd)
  const isInPreMode = preState !== undefined && preState.mode === 'pre'

  let changesets = await readChangesets(cwd)

  if (isInPreMode) {
    const changesetsToFilter = new Set(preState!.changesets)
    changesets = changesets.filter(x => !changesetsToFilter.has(x.id))
  }

  return {
    preState: isInPreMode ? preState : undefined,
    changesets,
  }
}
