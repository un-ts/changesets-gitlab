import { readPreState } from '@changesets/pre'
import { readChangesets } from '@changesets/read'
import type { PreState, NewChangeset } from '@changesets/types'

export interface ChangesetState {
  preState: PreState | undefined
  changesets: NewChangeset[]
}

export default async function readChangesetState(
  cwd: string = process.cwd(),
): Promise<ChangesetState> {
  const preState = await readPreState(cwd)
  const isInPreMode = preState?.mode === 'pre'

  let changesets = await readChangesets(cwd)

  if (isInPreMode) {
    // In Changesets v3, versioned prerelease changesets are stored in
    // `.changeset/pre/` and have IDs starting with `pre/`. These should
    // be filtered out when in pre mode, as they are already consumed.
    changesets = changesets.filter(x => !x.id.startsWith('pre/'))
  }

  return {
    preState: isInPreMode ? preState : undefined,
    changesets,
  }
}
