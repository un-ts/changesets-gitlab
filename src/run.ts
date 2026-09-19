import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import * as core from '@actions/core'
import { exec, getExecOutput } from '@actions/exec'
import type { Package } from '@manypkg/get-packages'
import { getPackages } from '@manypkg/get-packages'
import pLimit from 'p-limit'

import type { GitLabApi } from './api.js'
import * as context from './context.js'
import type { GitLab } from './gitlab.js'
import readChangesetState from './read-changeset-state.js'
import {
  execChangesetsCli,
  getChangedPackages,
  getChangelogEntry,
  getExecOutputChangesetsCli,
  getOptionalInput,
  getVersionsByDirectory,
  isErrorWithCode,
  sortTheThings,
} from './utils.js'

const limit = pLimit(2 * 3)

// With more packages than this, tags are pushed individually (unless the
// `git_push_create_all_pipelines` feature flag is enabled) to avoid triggering
// one pipeline per tag.
const GITLAB_MAX_TAGS = 4

export const createRelease = async (
  api: GitLabApi,
  { pkg, tagName }: { pkg: Package; tagName: string },
) => {
  try {
    const changelogFileName = path.join(pkg.dir, 'CHANGELOG.md')

    const changelog = await fs.readFile(changelogFileName, 'utf8')

    const changelogEntry = getChangelogEntry(changelog, pkg.packageJson.version)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!changelogEntry) {
      // we can find a changelog but not the entry for this version
      // if this is true, something has probably gone wrong
      throw new Error(
        `Could not find changelog entry for ${pkg.packageJson.name}@${pkg.packageJson.version}`,
      )
    }

    await api.ProjectReleases.create(context.projectId, {
      name: tagName,
      tag_name: tagName,
      description: changelogEntry.content,
      pre_release: pkg.packageJson.version.includes('-'),
    })
  } catch (err: unknown) {
    // if we can't find a changelog, the user has probably disabled changelogs
    if (!isErrorWithCode(err, 'ENOENT')) {
      throw err
    }
  }
}

export interface PublishOptions {
  script?: string
  fromPackDir?: string
  createGitlabReleases?: boolean
  pushGitTags?: boolean
  gitlab: GitLab
  cwd?: string
}

export interface PublishedPackage {
  name: string
  version: string
}

export type PublishResult =
  | {
      published: false
      exitCode: number
    }
  | {
      published: true
      publishedPackages: PublishedPackage[]
      exitCode: number
    }

interface ChangesetsOutputEvent {
  type: string
  tag: string
  packageName: string
}

function isChangesetsOutputEvent(
  value: unknown,
): value is ChangesetsOutputEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'git-tag' &&
    'tag' in value &&
    typeof value.tag === 'string' &&
    'packageName' in value &&
    typeof value.packageName === 'string'
  )
}

class ChangesetsOutputReadError extends Error {}

async function readChangesetsOutput(
  outputPath: string,
): Promise<ChangesetsOutputEvent[]> {
  let rawOutput: string
  try {
    rawOutput = await fs.readFile(outputPath, 'utf8')
  } catch (err) {
    throw new ChangesetsOutputReadError(
      `Failed to read changesets output at ${outputPath}`,
      { cause: err },
    )
  }

  const events: ChangesetsOutputEvent[] = []

  for (const line of rawOutput.split('\n')) {
    if (!line.trim()) {
      continue
    }

    let event: unknown
    try {
      event = JSON.parse(line)
    } catch (err) {
      throw new Error(`Failed to parse changesets output event: ${line}`, {
        cause: err,
      })
    }

    if (isChangesetsOutputEvent(event)) {
      events.push(event)
    }
  }

  return events
}

export async function runPublish({
  script,
  fromPackDir,
  gitlab,
  createGitlabReleases = true,
  pushGitTags = true,
  cwd = process.cwd(),
}: PublishOptions): Promise<PublishResult> {
  const { api } = gitlab
  // Changesets creates annotated tags locally, including when the action pushes
  // those tags through the GitLab API. It might also be important for custom
  // publish scripts to have a valid git user configured.
  await gitlab.ensureGitUser()

  // Changesets v3 uses a shared output file (via CHANGESETS_OUTPUT env var)
  // to report published packages as NDJSON events.
  const outputFile = path.join(
    os.tmpdir(),
    `changesets-output-${randomUUID()}.ndjson`,
  )

  let changesetPublishExitCode: number

  try {
    const execOptions = {
      cwd,
      ignoreReturnCode: true,
      env: {
        ...process.env,
        CHANGESETS_OUTPUT: outputFile,
      },
    }
    if (script) {
      const output = await getExecOutput(script, undefined, execOptions)
      changesetPublishExitCode = output.exitCode
    } else {
      const args = ['publish']
      if (fromPackDir) {
        args.push('--from-pack-dir', fromPackDir)
      }
      const output = await getExecOutputChangesetsCli(args, execOptions)
      changesetPublishExitCode = output.exitCode
    }

    const { packages, tool } = await getPackages(cwd)

    const pushAllTags =
      gitlab.pushWithGitCli &&
      (packages.length <= GITLAB_MAX_TAGS ||
        (await api.FeatureFlags.show(
          context.projectId,
          'git_push_create_all_pipelines',
        )
          .then(({ active }) => active)
          .catch(() => false)))

    let outputEvents: ChangesetsOutputEvent[]
    try {
      outputEvents = await readChangesetsOutput(outputFile)
    } catch (err) {
      if (!script || !(err instanceof ChangesetsOutputReadError)) {
        throw err
      }
      core.warning(
        `${err.message}. GitLab releases and git tags cannot be created without this output. Ensure the custom publish script passes CHANGESETS_OUTPUT to the Changesets CLI.`,
      )
      outputEvents = []
    }
    const packagesByName = new Map(packages.map(x => [x.packageJson.name, x]))

    const releases = outputEvents.map(event => {
      const pkg = packagesByName.get(event.packageName)
      if (pkg === undefined) {
        throw new Error(
          `Package "${event.packageName}" not found. This is probably a bug in the action, please open an issue.`,
        )
      }
      return { pkg, tag: event.tag }
    })

    if (tool.type === 'root' && packages.length === 0) {
      throw new Error(
        'No package found. This is probably a bug in the action, please open an issue.',
      )
    }

    if (createGitlabReleases || pushGitTags) {
      const tags = releases.map(({ tag }) => tag)
      await (pushAllTags
        ? gitlab.pushTags(tags)
        : Promise.all(tags.map(tag => gitlab.pushTag(tag))))
    }

    if (createGitlabReleases) {
      await Promise.all(
        releases.map(({ pkg, tag }) =>
          limit(() => createRelease(api, { pkg, tagName: tag })),
        ),
      )
    }

    if (releases.length > 0) {
      return {
        published: true,
        publishedPackages: releases.map(({ pkg }) => ({
          name: pkg.packageJson.name,
          version: pkg.packageJson.version,
        })),
        exitCode: changesetPublishExitCode,
      }
    }

    return { published: false, exitCode: changesetPublishExitCode }
  } finally {
    // Clean up the temp file on both success and failure
    await fs.rm(outputFile, { force: true })
  }
}

export interface VersionOptions {
  script?: string
  gitlab: GitLab
  cwd?: string
  mrTitle?: string
  commitMessage?: string
  hasPublishScript?: boolean
  prDraft?: 'always' | 'create'
  mrTargetBranch?: string
  removeSourceBranch?: boolean
}

export interface RunVersionResult {
  /** The merge request number that was created or updated, if any */
  pullRequestNumber?: number
}

const DRAFT_PREFIX_PATTERN = /^(?:Draft:|WIP:)\s*/i

const withDraftPrefix = (title: string, draft: boolean) => {
  const stripped = title.replace(DRAFT_PREFIX_PATTERN, '')
  return draft ? `Draft: ${stripped}` : stripped
}

export async function runVersion({
  script,
  gitlab,
  cwd = process.cwd(),
  mrTitle = 'Version Packages',
  commitMessage = 'Version Packages',
  hasPublishScript = false,
  prDraft,
  mrTargetBranch = context.ref,
  removeSourceBranch = false,
}: VersionOptions): Promise<RunVersionResult> {
  const currentBranch = context.ref
  const versionBranch = `changeset-release/${currentBranch}`

  const { api } = gitlab
  const { preState } = await readChangesetState(cwd)

  await gitlab.prepareBranch(versionBranch, currentBranch)

  const labels = getOptionalInput('labels')
    ?.split(',')
    .map(x => x.trim())

  const versionsByDirectory = await getVersionsByDirectory(cwd)

  await (script
    ? exec(script, undefined, { cwd })
    : execChangesetsCli(['version'], { cwd }))

  const changedPackages = await getChangedPackages(cwd, versionsByDirectory)

  // GitLab errors when creating a merge request whose source branch has no
  // commits relative to the target, so skip it when nothing was bumped. Unlike
  // checking the worktree, the version diff also holds when the version command
  // committed the changes itself (`.changeset/config.json` `commit`).
  if (changedPackages.length === 0) {
    core.info(
      'No packages were bumped after running version command, skipping merge request creation',
    )
    return {}
  }

  const mrBodyPromise = (async () => {
    const changedPackagesInfo = await Promise.all(
      changedPackages.map(async pkg => {
        const changelogContents = await fs.readFile(
          path.join(pkg.dir, 'CHANGELOG.md'),
          'utf8',
        )

        const entry = getChangelogEntry(
          changelogContents,
          pkg.packageJson.version,
        )
        return {
          highestLevel: entry.highestLevel,
          private: !!pkg.packageJson.private,
          content:
            `## ${pkg.packageJson.name}@${pkg.packageJson.version}\n\n` +
            entry.content,
        }
      }),
    )

    const releasesInfo = changedPackagesInfo
      .filter(Boolean)
      .sort(sortTheThings)
      .map(x => x.content)
      .join('\n ')

    const preStateMessage = preState
      ? `
⚠️⚠️⚠️⚠️⚠️⚠️

\`${currentBranch}\` is currently in **pre mode** so this branch has prereleases rather than normal releases. If you want to exit prereleases, run \`changeset pre exit\` on \`${currentBranch}\`.

⚠️⚠️⚠️⚠️⚠️⚠️
`
      : ''

    return `This MR was opened by the [changesets-gitlab](https://github.com/un-ts/changesets-gitlab) GitLab CI script. When you're ready to do a release, you can merge this and ${
      hasPublishScript
        ? 'the packages will be published to npm automatically'
        : 'publish to npm yourself or [setup this action to publish automatically](https://github.com/un-ts/changesets-gitlab#with-publishing)'
    }. If you're not ready to do a release yet, that's fine, whenever you add more changesets to ${currentBranch}, this MR will be updated.
${preStateMessage}
# Releases
${releasesInfo}`
  })()

  const preStateSuffix = preState ? ` (${preState.tag})` : ''
  const baseMrTitle = `${mrTitle}${preStateSuffix}`

  const finalCommitMessage = `${commitMessage}${preStateSuffix}`
  await gitlab.pushChanges({
    branch: versionBranch,
    message: finalCommitMessage,
  })

  const searchResult = await api.MergeRequests.all({
    projectId: context.projectId,
    state: 'opened',
    sourceBranch: versionBranch,
    target_branch: mrTargetBranch,
    maxPages: 1,
    perPage: 1,
  })
  core.debug(JSON.stringify(searchResult, null, 2))
  let pullRequestNumber: number
  if (searchResult.length === 0) {
    const finalMrTitle = withDraftPrefix(
      baseMrTitle,
      prDraft === 'create' || prDraft === 'always',
    )
    core.info(
      `Creating merge request from ${versionBranch} to ${mrTargetBranch}`,
    )
    const mergeRequest = await api.MergeRequests.create(
      context.projectId,
      versionBranch,
      mrTargetBranch,
      finalMrTitle,
      {
        description: await mrBodyPromise,
        removeSourceBranch,
        labels,
      },
    )
    pullRequestNumber = mergeRequest.iid
  } else {
    pullRequestNumber = searchResult[0].iid
    // `create` only applies to new MRs, so an existing one keeps its state
    // unless `always` is requested.
    const finalMrTitle = withDraftPrefix(
      baseMrTitle,
      prDraft === 'always' || DRAFT_PREFIX_PATTERN.test(searchResult[0].title),
    )
    core.info(`Updating found merge request !${pullRequestNumber}`)
    await api.MergeRequests.edit(context.projectId, pullRequestNumber, {
      title: finalMrTitle,
      description: await mrBodyPromise,
      removeSourceBranch,
      labels,
    })
  }

  return { pullRequestNumber }
}
