import type {
  ChangelogFunctions,
  ModCompWithPackage,
  NewChangesetWithCommit,
  VersionType,
} from '@changesets/types'
import {
  GitbeakerRequestError,
  type ExpandedCommitSchema,
  type MergeRequestSchema,
} from '@gitbeaker/rest'

import { createApi, type GitLabApi } from './api.ts'

const HTTP_STATUS_NOT_FOUND = 404

const DEFAULT_SERVER_URL = 'https://gitlab.com'

const RELEASE_LINE_TOKENS = [
  'summary',
  'ref',
  'pull',
  'mr',
  'commit',
  'authors',
] as const

// Mirrors `@changesets/changelog-github`, but keeps GitLab's `!iid` merge
// request references and `/-/` URLs. Existing Markdown links are matched first
// so refs inside them are left untouched.
const REF_REGEX = /\[[^[\]]*\]\([^()]*\)|\B#([1-9]\d*)\b|\B!([1-9]\d*)\b/g

const TOKEN_REGEX = /\{(\w+)\}/g

const MR_PREFIX_REGEX =
  /^[ \t]*(?:mr|merge request|pr|pull request):[ \t]*[#!]?(\d+)/im
const COMMIT_PREFIX_REGEX = /^[ \t]*commit:[ \t]*(\S+)/im
const AUTHOR_PREFIX_REGEX = /^[ \t]*(?:author|user):[ \t]*@?(\S+)/gim

interface ChangelogOptions {
  repo?: string
  disableThanks: boolean
  template?: string
}

interface ChangelogConfig {
  repo: string
  serverUrl: string
}

interface UserInfo {
  username: string
  name: string
  url: string
  markdownLink: string
}

interface CommitLink {
  sha: string
  url: string
  markdownLink: string
}

interface MergeRequestLink {
  iid: number
  url: string
  markdownLink: string
}

interface CommitInfo {
  commit: CommitLink
  author?: UserInfo
  mr?: MergeRequestLink
}

interface MergeRequestInfo {
  mr: MergeRequestLink
  author?: UserInfo
  commit?: CommitLink
}

interface ReleaseLineLinks {
  commit?: string
  mr?: string
  user?: string
}

interface ReleaseLineTokens {
  summary: string
  ref: string
  pull: string
  mr: string
  commit: string
  authors: string
}

interface ParsedSummary {
  mr?: number
  commit?: string
  users: string[]
}

const getServerUrl = () =>
  (
    process.env.GITLAB_HOST ??
    process.env.CI_SERVER_URL ??
    DEFAULT_SERVER_URL
  ).replace(/\/$/, '')

const parseOptions = (
  options: Record<string, unknown> | null,
): ChangelogOptions => {
  const record = options ?? {}
  return {
    repo:
      typeof record.repo === 'string' && record.repo ? record.repo : undefined,
    disableThanks: record.disableThanks === true,
    template:
      typeof record.template === 'string' && record.template
        ? record.template
        : undefined,
  }
}

const resolveConfig = (options: ChangelogOptions): ChangelogConfig => {
  const repo = options.repo || process.env.CI_PROJECT_PATH
  if (!repo) {
    throw new Error(
      'Please provide a repo to this changelog generator like this:\n' +
        '"changelog": ["changesets-gitlab/changelog", { "repo": "group/project" }]\n' +
        'or set the CI_PROJECT_PATH environment variable.',
    )
  }
  return { repo, serverUrl: getServerUrl() }
}

let api: GitLabApi | undefined

const getApi = (serverUrl: string) => {
  const token = process.env.GITLAB_TOKEN
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

const getMergeRequestInfo = async (
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

const getCommitInfo = async (
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

const linkifyRefs = (line: string, { serverUrl, repo }: ChangelogConfig) =>
  line.replaceAll(REF_REGEX, (match, issue?: string, mr?: string) => {
    if (issue) {
      return `[#${issue}](${serverUrl}/${repo}/-/issues/${issue})`
    }
    if (mr) {
      return `[!${mr}](${serverUrl}/${repo}/-/merge_requests/${mr})`
    }
    return match
  })

const renderTemplate = (template: string, tokens: ReleaseLineTokens) =>
  template.replaceAll(TOKEN_REGEX, (_match, name: string) => {
    if (!Object.hasOwn(tokens, name)) {
      throw new Error(
        `Unknown changelog template token "{${name}}". Valid tokens are: ${RELEASE_LINE_TOKENS.map(
          token => `{${token}}`,
        ).join(', ')}.`,
      )
    }
    return tokens[name as keyof ReleaseLineTokens]
  })

const getRef = ({ mr, commit }: ReleaseLineLinks) => {
  if (mr) {
    return `(${mr})`
  }
  if (commit) {
    return `(${commit})`
  }
  return ''
}

const buildReleaseLineTokens = ({
  summaryLinked,
  links,
  users,
}: {
  summaryLinked: string
  links: ReleaseLineLinks
  users: string | null | undefined
}): ReleaseLineTokens => ({
  summary: summaryLinked,
  ref: getRef(links),
  pull: links.mr ?? '',
  mr: links.mr ?? '',
  commit: links.commit ?? '',
  authors: users ?? '',
})

const parseSummary = (summary: string) => {
  const parsed: ParsedSummary = { users: [] }

  const lines = summary
    .replace(MR_PREFIX_REGEX, (_, mr: string) => {
      const num = Number(mr)
      if (!Number.isNaN(num)) {
        parsed.mr = num
      }
      return ''
    })
    .replace(COMMIT_PREFIX_REGEX, (_, commit: string) => {
      parsed.commit = commit
      return ''
    })
    .replaceAll(AUTHOR_PREFIX_REGEX, (_, user: string) => {
      parsed.users.push(user)
      return ''
    })
    .trim()
    .split('\n')
    .map(line => line.trimEnd())

  return { parsed, lines }
}

const getUsers = (
  parsed: ParsedSummary,
  links: ReleaseLineLinks,
  { disableThanks, serverUrl }: ChangelogOptions & { serverUrl: string },
) => {
  if (disableThanks) {
    return null
  }
  if (parsed.users.length > 0) {
    return parsed.users
      .map(user => `[@${user}](${serverUrl}/${user})`)
      .join(', ')
  }
  return links.user ?? null
}

const getReleaseLine = async (
  changeset: NewChangesetWithCommit,
  _type: VersionType,
  options: Record<string, unknown> | null,
) => {
  const parsedOptions = parseOptions(options)
  const config = resolveConfig(parsedOptions)

  const { parsed, lines } = parseSummary(changeset.summary)
  const [firstLine, ...futureLines] = lines

  const links: ReleaseLineLinks = {}

  if (parsed.mr == null) {
    const commit = parsed.commit ?? changeset.commit
    if (commit) {
      const info = await getCommitInfo(config, commit)
      links.commit = info?.commit.markdownLink
      links.mr = info?.mr?.markdownLink
      links.user = info?.author?.markdownLink
    }
  } else {
    const info = await getMergeRequestInfo(config, parsed.mr)
    links.commit = info?.commit?.markdownLink
    links.mr = info?.mr.markdownLink
    links.user = info?.author?.markdownLink
    if (parsed.commit) {
      links.commit = toCommitLink(config, parsed.commit).markdownLink
    }
  }

  const users = getUsers(parsed, links, {
    ...parsedOptions,
    serverUrl: config.serverUrl,
  })

  const summaryLinked = linkifyRefs(firstLine, config)
  const continuation = futureLines
    .map(line => `  ${linkifyRefs(line, config)}`)
    .join('\n')

  if (parsedOptions.template) {
    const tokens = buildReleaseLineTokens({ summaryLinked, links, users })
    return `${renderTemplate(parsedOptions.template, tokens).trimEnd()}\n${continuation}`
  }

  const prefixParts = [
    links.mr == null ? '' : ` ${links.mr}`,
    links.commit == null ? '' : ` ${links.commit}`,
    users == null ? '' : ` Thanks ${users}!`,
  ].join('')
  const prefix = prefixParts ? `${prefixParts} -` : ''

  return `\n\n-${prefix} ${summaryLinked}\n${continuation}`
}

const getDependencyReleaseLine = async (
  changesets: NewChangesetWithCommit[],
  dependenciesUpdated: ModCompWithPackage[],
  options: Record<string, unknown> | null,
) => {
  const parsedOptions = parseOptions(options)
  const config = resolveConfig(parsedOptions)

  if (dependenciesUpdated.length === 0) {
    return ''
  }

  const commitLinkResults = await Promise.all(
    changesets.map(async changeset => {
      if (!changeset.commit) {
        return
      }
      const info = await getCommitInfo(config, changeset.commit)
      return info?.commit.markdownLink ?? `\`${changeset.commit.slice(0, 7)}\``
    }),
  )
  const commitLinks = commitLinkResults.filter(
    (link): link is string => link != null,
  )

  return [
    `- Updated dependencies [${commitLinks.join(', ')}]:`,
    ...dependenciesUpdated.map(
      dependency => `  - ${dependency.name}@${dependency.newVersion}`,
    ),
  ].join('\n')
}

const changelogFunctions: ChangelogFunctions = {
  getReleaseLine,
  getDependencyReleaseLine,
}

export default changelogFunctions
