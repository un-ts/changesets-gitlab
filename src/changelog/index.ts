import type {
  ChangelogFunctions,
  ModCompWithPackage,
  NewChangesetWithCommit,
  VersionType,
} from '@changesets/types'

import {
  parseOptions,
  readEnv,
  resolveConfig,
  type ChangelogConfig,
  type ChangelogOptions,
} from './env.js'
import { getCommitInfo, getMergeRequestInfo } from './get-gitlab-info.js'
import {
  buildReleaseLineTokens,
  renderTemplate,
  type ReleaseLineLinks,
} from './render-template.js'

// Mirrors `@changesets/changelog-github`, but keeps GitLab's `!iid` merge
// request references and `/-/` URLs, and adds `mr:`/`merge request:` prefixes
// and an `{mr}` template token. Existing Markdown links are matched first so
// refs inside them are left untouched.
const REF_REGEX = /\[[^[\]]*\]\([^()]*\)|\B#([1-9]\d*)\b|\B!([1-9]\d*)\b/g

const MR_PREFIX_REGEX =
  /^[ \t]*(?:mr|merge request|pr|pull request):[ \t]*[#!]?(\d+)/im
const COMMIT_PREFIX_REGEX = /^[ \t]*commit:[ \t]*(\S+)/im
const AUTHOR_PREFIX_REGEX = /^[ \t]*(?:author|user):[ \t]*@?(\S+)/gim

interface ParsedSummary {
  mr?: number
  commit?: string
  users: string[]
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

const parseSummary = (summary: string) => {
  const parsed: ParsedSummary = { users: [] }

  const lines = summary
    .replace(MR_PREFIX_REGEX, (match, mr: string) => {
      const num = Number(mr)
      if (Number.isSafeInteger(num) && num > 0) {
        parsed.mr = num
        return ''
      }
      return match
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
  const config = resolveConfig(parsedOptions, readEnv())

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
      links.commit = `[\`${parsed.commit.slice(0, 7)}\`](${config.serverUrl}/${config.repo}/-/commit/${parsed.commit})`
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
  const config = resolveConfig(parsedOptions, readEnv())

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
