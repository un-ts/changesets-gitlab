import path from 'path'
import _ from 'module'

import { exec } from '@actions/exec'
import { Gitlab } from '@gitbeaker/core'
import { getPackages, Package } from '@manypkg/get-packages'
import fs from 'fs-extra'
import resolveFrom from 'resolve-from'
import semver from 'semver'

import * as context from './context.js'
import * as gitUtils from './gitUtils.js'
import readChangesetState from './readChangesetState.js'
import {
  getChangelogEntry,
  execWithOutput,
  getChangedPackages,
  sortTheThings,
  getVersionsByDirectory,
} from './utils.js'

import { createApi } from './index.js'

const createRelease = async (
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

    await api.Releases.create(context.projectId, {
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

interface PublishOptions {
  script: string
  gitlabToken: string
  cwd?: string
}

interface PublishedPackage {
  name: string
  version: string
}

type PublishResult =
  | {
      published: false
    }
  | {
      published: true
      publishedPackages: PublishedPackage[]
    }

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function runPublish({
  script,
  gitlabToken,
  cwd = process.cwd(),
}: PublishOptions): Promise<PublishResult> {
  const api = createApi(gitlabToken)
  const [publishCommand, ...publishArgs] = script.split(/\s+/)

  const changesetPublishOutput = await execWithOutput(
    publishCommand,
    publishArgs,
    { cwd },
  )

  await gitUtils.pushTags()

  const { packages, tool } = await getPackages(cwd)
  const releasedPackages: Package[] = []

  // eslint-disable-next-line no-negated-condition -- do not change original source code logic
  if (tool !== 'root') {
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

    await Promise.all(
      releasedPackages.map(pkg =>
        createRelease(api, {
          pkg,
          tagName: `${pkg.packageJson.name}@${pkg.packageJson.version}`,
        }),
      ),
    )
  } else {
    if (packages.length === 0) {
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
        await createRelease(api, {
          pkg,
          tagName: `v${pkg.packageJson.version}`,
        })
        break
      }
    }
  }

  if (releasedPackages.length > 0) {
    return {
      published: true,
      publishedPackages: releasedPackages.map(pkg => ({
        name: pkg.packageJson.name,
        version: pkg.packageJson.version,
      })),
    }
  }

  return { published: false }
}

const cjsRequire =
  typeof require === 'undefined' ? _.createRequire(import.meta.url) : require

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

interface VersionOptions {
  script?: string
  gitlabToken: string
  cwd?: string
  prTitle?: string
  commitMessage?: string
  hasPublishScript?: boolean
}

export async function runVersion({
  script,
  gitlabToken,
  cwd = process.cwd(),
  prTitle = 'Version Packages',
  commitMessage = 'Version Packages',
  hasPublishScript = false,
}: VersionOptions) {
  const branch = context.ref
  const versionBranch = `changeset-release/${branch}`
  const api = createApi(gitlabToken)
  const { preState } = await readChangesetState(cwd)

  await gitUtils.switchToMaybeExistingBranch(versionBranch)
  await exec('git', ['fetch', 'origin', branch])
  await gitUtils.reset(`origin/${branch}`)

  const versionsByDirectory = await getVersionsByDirectory(cwd)

  if (script) {
    const [versionCommand, ...versionArgs] = script.split(/\s+/)
    await exec(versionCommand, versionArgs, { cwd })
  } else {
    const changesetsCliPkgJson = requireChangesetsCliPkgJson(cwd)
    const cmd = semver.lt(changesetsCliPkgJson.version, '2.0.0')
      ? 'bump'
      : 'version'
    await exec('node', [resolveFrom(cwd, '@changesets/cli/bin.js'), cmd], {
      cwd,
    })
  }

  const changedPackages = await getChangedPackages(cwd, versionsByDirectory)

  const prBodyPromise = (async () =>
    `This PR was opened by the [changesets-gitlab](https://github.com/rx-ts/changesets-gitlab) GitLab CI script. When you're ready to do a release, you can merge this and ${
      hasPublishScript
        ? 'the packages will be published to npm automatically'
        : 'publish to npm yourself or [setup this action to publish automatically](https://github.com/rx-ts/changesets-gitlab#with-publishing)'
    }. If you're not ready to do a release yet, that's fine, whenever you add more changesets to ${branch}, this PR will be updated.
${
  preState
    ? `
⚠️⚠️⚠️⚠️⚠️⚠️

\`${branch}\` is currently in **pre mode** so this branch has prereleases rather than normal releases. If you want to exit prereleases, run \`changeset pre exit\` on \`${branch}\`.

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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      .filter(x => x)
      .sort(sortTheThings)
      .map(x => x.content)
      .join('\n '))()

  const finalPrTitle = `${prTitle}${preState ? ` (${preState.tag})` : ''}`

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
    target_branch: branch,
    maxPages: 1,
    perPage: 1,
  })
  console.log(JSON.stringify(searchResult, null, 2))
  if (searchResult.length === 0) {
    console.log('creating pull request')
    await api.MergeRequests.create(
      context.projectId,
      versionBranch,
      branch,
      finalPrTitle,
      {
        description: await prBodyPromise,
      },
    )
  } else {
    await api.MergeRequests.edit(context.projectId, searchResult[0].iid, {
      title: finalPrTitle,
      description: await prBodyPromise,
    })
    console.log('pull request found')
  }
}
