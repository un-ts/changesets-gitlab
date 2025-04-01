import { readPreState } from '@changesets/pre'
import readChangesets from '@changesets/read'
import type { PreState, NewChangeset } from '@changesets/types'

export interface ChangesetState {
  preState: PreState | undefined
  changesets: NewChangeset[]
}

export default async function readChangesetState(
  cwd: string = process.cwd(),
): Promise<ChangesetState> {
  const preState = await readPreState(cwd)
  const isInPreMode = preState !== undefined && preState.mode === 'pre'

  let changesets = await readChangesets(cwd)

  if (isInPreMode) {
    const changesetsToFilter = new Set(preState.changesets)
    changesets = changesets.filter(x => !changesetsToFilter.has(x.id))
  }

  return {
    preState: isInPreMode ? preState : undefined,
    changesets,
  }
}
