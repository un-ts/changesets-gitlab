import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { exec } from '@actions/exec'
import type { Gitlab } from '@gitbeaker/core'
import type { Package } from '@manypkg/get-packages'
import { getPackages } from '@manypkg/get-packages'
import pLimit from 'p-limit'
import resolveFrom from 'resolve-from'
import semver from 'semver'

import { createApi } from './api.ts'
import * as context from './context.js'
import * as gitUtils from './git-utils.js'
import readChangesetState from './read-changeset-state.js'
import {
  cjsRequire,
  execWithOutput,
  getChangedPackages,
  getChangelogEntry,
  getOptionalInput,
  getVersionsByDirectory,
  GITLAB_MAX_TAGS,
  sortTheThings,
} from './utils.js'

const limit = pLimit(2 * 3)

export const createRelease = async (
  api: Gitlab,
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
    if ((err as { code: string }).code !== 'ENOENT') {
      throw err
    }
  }
}

export interface PublishOptions {
  script: string
  gitlabToken: string
  createGitlabReleases?: boolean
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

async function readChangesetsOutput(
  outputPath: string,
): Promise<ChangesetsOutputEvent[]> {
  let rawOutput: string
  try {
    rawOutput = await fs.readFile(outputPath, 'utf8')
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'ENOENT') {
      return []
    }
    throw err
  }

  const events: ChangesetsOutputEvent[] = []

  let lineStart = 0
  while (lineStart <= rawOutput.length) {
    let lineEnd = rawOutput.indexOf('\n', lineStart)
    if (lineEnd === -1) {
      lineEnd = rawOutput.length
    }
    const line = rawOutput.slice(lineStart, lineEnd)
    lineStart = lineEnd + 1

    if (/^\s*$/.test(line)) {
      continue
    }

    let event: unknown
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }

    if (isChangesetsOutputEvent(event)) {
      events.push(event)
    }
  }

  return events
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function runPublish({
  script,
  gitlabToken,
  createGitlabReleases = true,
  cwd = process.cwd(),
}: PublishOptions): Promise<PublishResult> {
  const api = createApi(gitlabToken)
  const [publishCommand, ...publishArgs] = script.split(/\s+/)

  // Changesets v3 uses a shared output file (via CHANGESETS_OUTPUT env var)
  // to report published packages, instead of printing "New tag:" to stdout.
  // We set up a temp file and pass it through, then fall back to stdout
  // parsing for Changesets v2 compatibility.
  const outputFile = path.join(
    os.tmpdir(),
    `changesets-output-${randomUUID()}.ndjson`,
  )

  const changesetPublishOutput = await execWithOutput(
    publishCommand,
    publishArgs,
    {
      cwd,
      ignoreReturnCode: true,
      env: {
        ...process.env,
        CHANGESETS_OUTPUT: outputFile,
      },
    },
  )

  const { packages, tool } = await getPackages(cwd)

  const pushAllTags =
    packages.length <= GITLAB_MAX_TAGS ||
    (await api.FeatureFlags.show(
      context.projectId,
      'git_push_create_all_pipelines',
    )
      .then(({ active }) => active)
      .catch(() => false))

  if (pushAllTags) {
    await gitUtils.pushTags()
  }

  // Try reading the Changesets v3 output file first
  const outputEvents = await readChangesetsOutput(outputFile)

  const releasedPackages: Package[] = []

  if (outputEvents.length > 0) {
    // Changesets v3: use output file events
    const packagesByName = new Map(packages.map(x => [x.packageJson.name, x]))
    for (const event of outputEvents) {
      const pkg = packagesByName.get(event.packageName)
      if (pkg === undefined) {
        throw new Error(
          `Package "${event.packageName}" not found.` +
            'This is probably a bug in the action, please open an issue',
        )
      }
      releasedPackages.push(pkg)
    }
  } else {
    // Changesets v2: fall back to stdout "New tag:" parsing
    if (tool === 'root') {
      if (packages.length !== 1) {
        throw new Error(
          `No package found.` +
            'This is probably a bug in the action, please open an issue',
        )
      }
      const pkg = packages[0]
      const newTagRegex = /New tag:/

      for (const line of changesetPublishOutput.stdout.split('\n')) {
        const match = newTagRegex.exec(line)

        if (match) {
          releasedPackages.push(pkg)
          break
        }
      }
    } else {
      // eslint-disable-next-line regexp/no-misleading-capturing-group, regexp/no-super-linear-backtracking, sonarjs/slow-regex
      const newTagRegex = /New tag:\s+(@[^/]+\/[^@]+|[^/]+)@(\S+)/
      const packagesByName = new Map(packages.map(x => [x.packageJson.name, x]))

      for (const line of changesetPublishOutput.stdout.split('\n')) {
        const match = newTagRegex.exec(line)
        if (match === null) {
          continue
        }
        const pkgName = match[1]
        const pkg = packagesByName.get(pkgName)
        if (pkg === undefined) {
          throw new Error(
            `Package "${pkgName}" not found.` +
              'This is probably a bug in the action, please open an issue',
          )
        }
        releasedPackages.push(pkg)
      }
    }
  }

  if (!pushAllTags) {
    await Promise.all(
      releasedPackages.map(pkg =>
        gitUtils.pushTag(`${pkg.packageJson.name}@${pkg.packageJson.version}`),
      ),
    )
  }
  if (createGitlabReleases) {
    await Promise.all(
      releasedPackages.map(pkg =>
        limit(() =>
          createRelease(api, {
            pkg,
            tagName:
              tool === 'root'
                ? `v${pkg.packageJson.version}`
                : `${pkg.packageJson.name}@${pkg.packageJson.version}`,
          }),
        ),
      ),
    )
  }

  if (releasedPackages.length > 0) {
    return {
      published: true,
      publishedPackages: releasedPackages.map(pkg => ({
        name: pkg.packageJson.name,
        version: pkg.packageJson.version,
      })),
      exitCode: changesetPublishOutput.code,
    }
  }

  return { published: false, exitCode: changesetPublishOutput.code }
}

const requireChangesetsCliPkgJson = (cwd: string) => {
  try {
    return cjsRequire(resolveFrom(cwd, '@changesets/cli/package.json')) as {
      version: string
    }
  } catch (err: unknown) {
    if ((err as { code: string } | undefined)?.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        `Have you forgotten to install \`@changesets/cli\` in "${cwd}"?`,
      )
    }
    throw err
  }
}

export interface VersionOptions {
  script?: string
  gitlabToken: string
  cwd?: string
  mrTitle?: string
  removeSourceBranch?: boolean
  mrTargetBranch?: string
  commitMessage?: string
  hasPublishScript?: boolean
}

export interface VersionResult {
  /** Whether the version command produced any file changes */
  hasChanges: boolean
}

export async function runVersion({
  script,
  gitlabToken,
  cwd = process.cwd(),
  mrTitle = 'Version Packages',
  mrTargetBranch = context.ref,
  commitMessage = 'Version Packages',
  removeSourceBranch = false,
  hasPublishScript = false,
}: VersionOptions): Promise<VersionResult> {
  const currentBranch = context.ref
  const versionBranch = `changeset-release/${currentBranch}`

  const api = createApi(gitlabToken)
  const { preState } = await readChangesetState(cwd)

  await gitUtils.switchToMaybeExistingBranch(versionBranch)
  await exec('git', ['fetch', 'origin', currentBranch])
  await gitUtils.reset(`origin/${currentBranch}`)

  const labels = getOptionalInput('labels')
    ?.split(',')
    .map(x => x.trim())

  const versionsByDirectory = await getVersionsByDirectory(cwd)

  // Changesets v3 exits with code 1 when there are no unreleased changesets,
  // so we ignore the return code and check for actual file changes instead.
  if (script) {
    const [versionCommand, ...versionArgs] = script.split(/\s+/)
    await exec(versionCommand, versionArgs, { cwd, ignoreReturnCode: true })
  } else {
    const changesetsCliPkgJson = requireChangesetsCliPkgJson(cwd)
    const cmd = semver.lt(changesetsCliPkgJson.version, '2.0.0')
      ? 'bump'
      : 'version'
    await exec('node', [resolveFrom(cwd, '@changesets/cli/bin.js'), cmd], {
      cwd,
      ignoreReturnCode: true,
    })
  }

  // After running the version command, check if there are actual file changes.
  // In Changesets v3, the version command may exit with code 1 when there are
  // no unreleased changesets. Even if it exits 0, it might produce no file
  // changes if all packages are already at the target version.
  // In either case, we should not create or update an empty release MR.
  if (await gitUtils.checkIfClean()) {
    console.log(
      'No file changes after running version command, skipping merge request creation',
    )
    return { hasChanges: false }
  }

  const changedPackages = await getChangedPackages(cwd, versionsByDirectory)

  const mrBodyPromise = (async () =>
    `This MR was opened by the [changesets-gitlab](https://github.com/un-ts/changesets-gitlab) GitLab CI script. When you're ready to do a release, you can merge this and ${
      hasPublishScript
        ? 'the packages will be published to npm automatically'
        : 'publish to npm yourself or [setup this action to publish automatically](https://github.com/un-ts/changesets-gitlab#with-publishing)'
    }. If you're not ready to do a release yet, that's fine, whenever you add more changesets to ${currentBranch}, this MR will be updated.
${
  preState
    ? `
⚠️⚠️⚠️⚠️⚠️⚠️

\`${currentBranch}\` is currently in **pre mode** so this branch has prereleases rather than normal releases. If you want to exit prereleases, run \`changeset pre exit\` on \`${currentBranch}\`.

⚠️⚠️⚠️⚠️⚠️⚠️
`
    : ''
}
# Releases
` +
    (
      await Promise.all(
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
    )
      // eslint-disable-next-line unicorn/no-await-expression-member
      .filter(Boolean)
      .sort(sortTheThings)
      .map(x => x.content)
      .join('\n '))()

  // eslint-disable-next-line sonarjs/no-nested-template-literals
  const finalMrTitle = `${mrTitle}${preState ? ` (${preState.tag})` : ''}`

  // project with `commit: true` setting could have already committed files
  if (!(await gitUtils.checkIfClean())) {
    const finalCommitMessage = `${commitMessage}${
      preState ? ` (${preState.tag})` : ''
    }`
    await gitUtils.commitAll(finalCommitMessage)
  }

  await gitUtils.push(versionBranch, { force: true })

  const searchResult = await api.MergeRequests.all({
    projectId: context.projectId,
    state: 'opened',
    sourceBranch: versionBranch,
    target_branch: mrTargetBranch,
    maxPages: 1,
    perPage: 1,
  })
  console.log(JSON.stringify(searchResult, null, 2))
  if (searchResult.length === 0) {
    console.log(
      `creating merge request from ${versionBranch} to ${mrTargetBranch}.`,
    )
    await api.MergeRequests.create(
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
  } else {
    console.log(`updating found merge request !${searchResult[0].iid}`)
    await api.MergeRequests.edit(context.projectId, searchResult[0].iid, {
      title: finalMrTitle,
      description: await mrBodyPromise,
      removeSourceBranch,
      labels,
    })
  }

  return { hasChanges: true }
}
