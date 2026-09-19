import { getCommentStatus } from './comment.js'
import { logGitbeakerError, setOutput } from './utils.js'

/**
 * GitLab command counterpart of the `changesets/action` `/pr-status`
 * sub-action: generates the changesets status message for the current merge
 * request without posting it.
 */
export const prStatus = async () => {
  const status = await getCommentStatus().catch(async (err: unknown) => {
    await logGitbeakerError(err)
    throw err
  })

  if (!status) {
    return
  }

  setOutput('comment-body', status.body)
}
