import type { Gitlab } from '@gitbeaker/rest'

import { createApi } from './api.ts'
import { isMrNote } from './comment.js'
import * as context from './context.js'
import { env } from './env.js'
import type { LooseString } from './types.js'
import { getRequiredInput, setOutput } from './utils.js'

const commentMarkerPrefix = 'changesets-gitlab-pr-comment'

const getCommentMarker = (updateId: string) =>
  commentMarkerPrefix === updateId
    ? `<!-- ${commentMarkerPrefix} -->`
    : `<!-- ${commentMarkerPrefix}:${updateId} -->`

interface ExistingComment {
  discussionId?: string
  noteId: number
}

async function findComment(
  api: Gitlab,
  mrIid: number,
  commentType: LooseString<'discussion' | 'note'>,
  marker: string,
) {
  const discussionOrNotes = await (commentType === 'discussion'
    ? api.MergeRequestDiscussions.all(context.projectId, mrIid)
    : api.MergeRequestNotes.all(context.projectId, mrIid))

  for (const discussionOrNote of discussionOrNotes) {
    if (isMrNote(discussionOrNote)) {
      if (discussionOrNote.body.includes(marker)) {
        return { noteId: discussionOrNote.id }
      }
      continue
    }

    const note = discussionOrNote.notes?.find(note =>
      note.body.includes(marker),
    )
    if (note) {
      return { discussionId: discussionOrNote.id, noteId: note.id }
    }
  }
}

async function createComment(
  api: Gitlab,
  mrIid: number,
  commentType: LooseString<'discussion' | 'note'>,
  body: string,
): Promise<number | string> {
  if (commentType === 'discussion') {
    const discussion = await api.MergeRequestDiscussions.create(
      context.projectId,
      mrIid,
      body,
    )
    return discussion.notes?.[0]?.id ?? discussion.id
  }

  const note = await api.MergeRequestNotes.create(
    context.projectId,
    mrIid,
    body,
  )
  return note.id
}

async function updateComment(
  api: Gitlab,
  mrIid: number,
  existing: ExistingComment,
  body: string,
): Promise<number> {
  if (existing.discussionId) {
    const note = await api.MergeRequestDiscussions.editNote(
      context.projectId,
      mrIid,
      existing.discussionId,
      existing.noteId,
      { body },
    )
    return note.id
  }

  const note = await api.MergeRequestNotes.edit(
    context.projectId,
    mrIid,
    existing.noteId,
    { body },
  )
  return note.id
}

/**
 * GitLab command counterpart of the `changesets/action` `/pr-comment`
 * sub-action: creates or updates a comment on the current merge request. When
 * `update-id` is set (the default), the comment is matched by an embedded
 * marker so it can be updated on later runs; pass a unique id to post a new
 * comment instead.
 */
export const prComment = async () => {
  const mrBranch = env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME
  if (!mrBranch) {
    throw new Error(
      'This command should only be run on a merge request pipeline',
    )
  }

  const { CI_MERGE_REQUEST_IID: mrIid, GITLAB_COMMENT_TYPE: commentType } = env

  const body = getRequiredInput('body')
  const updateId = process.env.INPUT_UPDATE_ID ?? commentMarkerPrefix

  const commentMarker = updateId ? getCommentMarker(updateId) : undefined
  const commentBody = commentMarker ? `${commentMarker}\n\n${body}` : body

  const api = createApi()

  const existing = commentMarker
    ? await findComment(api, mrIid, commentType, commentMarker)
    : undefined

  const commentId = existing
    ? await updateComment(api, mrIid, existing, commentBody)
    : await createComment(api, mrIid, commentType, commentBody)

  setOutput('comment-id', commentId)
}
