import fs from 'node:fs/promises'
import path from 'node:path'

import * as core from '@actions/core'
import { assembleReleasePlan } from '@changesets/assemble-release-plan'
import { validateConfig as parseConfig } from '@changesets/config'
import { parseChangesetFile as parseChangeset } from '@changesets/parse'
import { shouldSkipPackage } from '@changesets/should-skip-package'
import type {
  PackageJSON,
  PreState,
  NewChangeset,
  WrittenConfig,
} from '@changesets/types'
import type { Package, Packages, Tool } from '@manypkg/get-packages'
import micromatch from 'micromatch'
import { parse } from 'yaml'

import { getAllFiles } from './utils.js'

export const getChangedPackages = async ({
  changedFiles: changedFilesPromise,
  cwdPrefix = '',
}: {
  changedFiles: Promise<string[]> | string[]
  cwdPrefix?: string
  // eslint-disable-next-line sonarjs/cognitive-complexity
}) => {
  function fetchFile(path: string) {
    return fs.readFile(`${cwdPrefix}${path}`, 'utf8')
  }

  let hasErrored = false

  async function fetchJsonFile<T = unknown>(path: string) {
    try {
      return JSON.parse(await fetchFile(path)) as T
    } catch (err) {
      hasErrored = true
      core.error(err as Error | string)
      return {} as unknown as T
    }
  }

  async function fetchTextFile(path: string) {
    try {
      return await fetchFile(path)
    } catch (err) {
      hasErrored = true
      core.error(err as Error | string)
      return ''
    }
  }

  async function getPackage(pkgPath: string): Promise<Package> {
    const jsonContent = await fetchJsonFile<PackageJSON>(
      `${pkgPath}/package.json`,
    )
    return {
      packageJson: jsonContent,
      dir: pkgPath,
      relativeDir: pkgPath,
    }
  }

  const rootPackageJsonContentsPromise = fetchJsonFile<
    PackageJSON & {
      workspaces?:
        | string[]
        | {
            packages: string[]
          }
      bolt?: {
        workspaces?: string[]
      }
    }
  >('package.json')
  const configPromise = fetchJsonFile<WrittenConfig>('.changeset/config.json')

  const tree = await getAllFiles(cwdPrefix)

  let preStatePromise: Promise<PreState> | undefined
  const changesetPromises: Array<Promise<NewChangeset>> = []
  const potentialWorkspaceDirectories: string[] = []
  let isPnpm = false
  const changedFiles = await changedFilesPromise

  for (const item of tree) {
    if (item.endsWith('/package.json')) {
      const dirPath = path.dirname(item)
      potentialWorkspaceDirectories.push(dirPath)
    } else if (item === 'pnpm-workspace.yaml') {
      isPnpm = true
    } else if (item === '.changeset/pre.json') {
      preStatePromise = fetchJsonFile(item)
    } else if (
      item !== '.changeset/README.md' &&
      item.startsWith('.changeset') &&
      item.endsWith('.md') &&
      changedFiles.includes(item)
    ) {
      const res = /\.changeset\/([^.]+)\.md/.exec(item)
      if (!res) {
        throw new Error('could not get name from changeset filename')
      }
      const id = res[1]
      changesetPromises.push(
        fetchTextFile(item).then(text => ({
          ...parseChangeset(text),
          id,
        })),
      )
    }
  }
  let tool: { type: string; globs: string[] } | undefined

  if (isPnpm) {
    const pnpmWorkspace = parse(await fetchTextFile('pnpm-workspace.yaml')) as {
      packages?: string[]
    }

    // If the `packages` field is omitted, only the root package is included in
    // the workspace, so fall back to the root package detection below.
    // https://pnpm.io/pnpm-workspace_yaml
    if (pnpmWorkspace.packages) {
      tool = {
        type: 'pnpm',
        globs: pnpmWorkspace.packages,
      }
    }
  } else {
    const rootPackageJsonContent = await rootPackageJsonContentsPromise

    if (rootPackageJsonContent.workspaces) {
      tool = {
        type: 'yarn',
        globs: Array.isArray(rootPackageJsonContent.workspaces)
          ? rootPackageJsonContent.workspaces
          : rootPackageJsonContent.workspaces.packages,
      }
    } else if (rootPackageJsonContent.bolt?.workspaces) {
      tool = {
        type: 'bolt',
        globs: rootPackageJsonContent.bolt.workspaces,
      }
    }
  }

  const rootPackageJsonContent = await rootPackageJsonContentsPromise

  const rootPackage: Package = {
    dir: '/',
    relativeDir: '.',
    packageJson: rootPackageJsonContent,
  }

  const packages: Packages = {
    rootDir: '/',
    rootPackage,
    tool: { type: tool ? tool.type : 'root' } as Tool,
    packages: [],
  }

  if (tool) {
    if (
      !Array.isArray(tool.globs) ||
      !tool.globs.every(x => typeof x === 'string')
    ) {
      throw new Error('globs are not valid: ' + JSON.stringify(tool.globs))
    }

    const matches = micromatch(potentialWorkspaceDirectories, tool.globs)
    packages.packages = await Promise.all(matches.map(dir => getPackage(dir)))
  } else {
    packages.packages.push(rootPackage)
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- https://github.com/microsoft/TypeScript/issues/9998
  if (hasErrored) {
    throw new Error('an error occurred when fetching files')
  }

  const config = await configPromise.then(rawConfig => {
    const result = parseConfig(rawConfig, packages)
    if (result.errors) {
      throw new Error(
        `Failed to parse changeset config: ${result.errors.join(', ')}`,
      )
    }
    return result.config
  })

  const releasePlan = assembleReleasePlan(
    await Promise.all(changesetPromises),
    packages,
    config,
    await preStatePromise,
  )

  return {
    changedPackages: packages.packages
      .filter(
        pkg =>
          (packages.tool.type === 'root' ||
            changedFiles.some(
              changedFile =>
                changedFile === pkg.dir ||
                changedFile.startsWith(`${pkg.dir}/`),
            )) &&
          // Reuse the same predicate Changesets uses to decide whether a
          // package is versionable: it skips ignored packages, private packages
          // that haven't opted into versioning via `privatePackages.version`,
          // and packages without a `version`. This keeps the suggested changeset
          // from producing the "Mixed changesets that contain both ignored and
          // not ignored packages are not allowed" error
          // (https://github.com/changesets/bot/issues/44).
          !shouldSkipPackage(pkg, {
            ignore: config.ignore,
            allowPrivatePackages: config.privatePackages.version,
          }),
      )
      .map(x => x.packageJson.name),
    releasePlan,
  }
}
