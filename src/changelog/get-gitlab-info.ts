import {
  GitbeakerRequestError,
  type ExpandedCommitSchema,
  type MergeRequestSchema,
} from '@gitbeaker/rest'

import { createApi, type GitLabApi } from '../api.ts'

import { readEnv, type ChangelogConfig } from './env.js'

const HTTP_STATUS_NOT_FOUND = 404

export interface UserInfo {
  username: string
  name: string
  url: string
  markdownLink: string
}

export interface CommitLink {
  sha: string
  url: string
  markdownLink: string
}

export interface MergeRequestLink {
  iid: number
  url: string
  markdownLink: string
}

export interface CommitInfo {
  commit: CommitLink
  author?: UserInfo
  mr?: MergeRequestLink
}

export interface MergeRequestInfo {
  mr: MergeRequestLink
  author?: UserInfo
  commit?: CommitLink
}

let api: GitLabApi | undefined

const getApi = (serverUrl: string) => {
  const token = readEnv().token
  if (!token) {
    throw new Error(
      `Please create a GitLab personal access token at ${serverUrl}/-/user_settings/personal_access_tokens with the \`read_api\` scope and add it as the \`GITLAB_TOKEN\` environment variable`,
    )
  }
  // `createApi` caches the client and applies the same `GITLAB_HOST` fallback.
  api ??= createApi(token)
  return api
}

const isNotFoundError = (err: unknown) =>
  err instanceof GitbeakerRequestError &&
  err.cause?.response.status === HTTP_STATUS_NOT_FOUND

const toUser = (
  author:
    | {
        username: string
        name: string
        web_url: string
      }
    | null
    | undefined,
): UserInfo | undefined =>
  author
    ? {
        username: author.username,
        name: author.name,
        url: author.web_url,
        markdownLink: `[@${author.username}](${author.web_url})`,
      }
    : undefined

const toCommitLink = (
  { serverUrl, repo }: ChangelogConfig,
  sha: string,
): CommitLink => {
  const url = `${serverUrl}/${repo}/-/commit/${sha}`
  return {
    sha,
    url,
    markdownLink: `[\`${sha.slice(0, 7)}\`](${url})`,
  }
}

const toMergeRequestLink = (mr: {
  iid: number
  web_url: string
}): MergeRequestLink => ({
  iid: mr.iid,
  url: mr.web_url,
  markdownLink: `[!${mr.iid}](${mr.web_url})`,
})

export const getMergeRequestInfo = async (
  config: ChangelogConfig,
  mrIid: number,
): Promise<MergeRequestInfo | undefined> => {
  try {
    const mr = await getApi(config.serverUrl).MergeRequests.show(
      config.repo,
      mrIid,
    )
    const mergeCommit = mr.merge_commit_sha || mr.squash_commit_sha
    return {
      mr: toMergeRequestLink(mr),
      author: toUser(mr.author),
      commit: mergeCommit ? toCommitLink(config, mergeCommit) : undefined,
    }
  } catch (err) {
    if (isNotFoundError(err)) {
      return undefined
    }
    throw err
  }
}

const compareMergeRequests = (
  a: { merged_at: string | null },
  b: { merged_at: string | null },
) => {
  if (a.merged_at == null && b.merged_at == null) {
    return 0
  }
  if (a.merged_at == null) {
    return 1
  }
  if (b.merged_at == null) {
    return -1
  }
  return a.merged_at.localeCompare(b.merged_at)
}

const getFirstMergeRequest = (mergeRequests: MergeRequestSchema[]) => {
  let first: MergeRequestSchema | undefined
  for (const mergeRequest of mergeRequests) {
    if (!first || compareMergeRequests(mergeRequest, first) < 0) {
      first = mergeRequest
    }
  }
  return first
}

export const getCommitInfo = async (
  config: ChangelogConfig,
  sha: string,
): Promise<CommitInfo | undefined> => {
  const gitlab = getApi(config.serverUrl)

  let commit: ExpandedCommitSchema
  try {
    commit = await gitlab.Commits.show(config.repo, sha)
  } catch (err) {
    if (isNotFoundError(err)) {
      return undefined
    }
    throw err
  }

  let mergeRequests: MergeRequestSchema[]
  try {
    mergeRequests = await gitlab.Commits.allMergeRequests(config.repo, sha)
  } catch (err) {
    if (!isNotFoundError(err)) {
      throw err
    }
    mergeRequests = []
  }

  const mr = getFirstMergeRequest(mergeRequests)

  return {
    commit: {
      sha,
      url: commit.web_url,
      markdownLink: `[\`${sha.slice(0, 7)}\`](${commit.web_url})`,
    },
    author: toUser(mr?.author),
    mr: mr ? toMergeRequestLink(mr) : undefined,
  }
}
