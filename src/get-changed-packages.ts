import fs from 'node:fs/promises'
import nodePath from 'node:path'

import assembleReleasePlan from '@changesets/assemble-release-plan'
import { parse as parseConfig } from '@changesets/config'
import parseChangeset from '@changesets/parse'
import type {
  PackageJSON,
  PreState,
  NewChangeset,
  WrittenConfig,
} from '@changesets/types'
import type { Gitlab } from '@gitbeaker/core'
import type { Packages, Tool } from '@manypkg/get-packages'
import micromatch from 'micromatch'
import { parse } from 'yaml'

import { getAllFiles } from './utils.js'

function fetchFile(path: string) {
  return fs.readFile(path, 'utf8')
}

export const getChangedPackages = async ({
  changedFiles: changedFilesPromise,
}: {
  changedFiles: Promise<string[]> | string[]
  api: Gitlab
  // eslint-disable-next-line sonarjs/cognitive-complexity
}) => {
  let hasErrored = false

  async function fetchJsonFile<T = unknown>(path: string) {
    try {
      const x = await fetchFile(path)
      return JSON.parse(x) as T
    } catch (err) {
      hasErrored = true
      console.error(err)
      return {} as unknown as T
    }
  }

  async function fetchTextFile(path: string) {
    try {
      return await fetchFile(path)
    } catch (err) {
      hasErrored = true
      console.error(err)
      return ''
    }
  }

  async function getPackage(pkgPath: string) {
    const jsonContent = await fetchJsonFile<PackageJSON>(
      pkgPath + '/package.json',
    )
    return {
      packageJson: jsonContent,
      dir: pkgPath,
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

  const tree = await getAllFiles(process.cwd())

  let preStatePromise: Promise<PreState> | undefined
  const changesetPromises: Array<Promise<NewChangeset>> = []
  const potentialWorkspaceDirectories: string[] = []
  let isPnpm = false
  const changedFiles = await changedFilesPromise

  for (const item of tree) {
    if (item.endsWith('/package.json')) {
      const dirPath = nodePath.dirname(item)
      potentialWorkspaceDirectories.push(dirPath)
    } else if (item === 'pnpm-workspace.yaml') {
      isPnpm = true
    } else if (item === '.changeset/pre.json') {
      preStatePromise = fetchJsonFile('.changeset/pre.json')
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
  let tool: { tool: Tool; globs: string[] } | undefined

  if (isPnpm) {
    tool = {
      tool: 'pnpm',
      globs: (
        parse(await fetchTextFile('pnpm-workspace.yaml')) as {
          packages: string[]
        }
      ).packages,
    }
  } else {
    const rootPackageJsonContent = await rootPackageJsonContentsPromise

    if (rootPackageJsonContent.workspaces) {
      tool = {
        tool: 'yarn',
        globs: Array.isArray(rootPackageJsonContent.workspaces)
          ? rootPackageJsonContent.workspaces
          : rootPackageJsonContent.workspaces.packages,
      }
    } else if (rootPackageJsonContent.bolt?.workspaces) {
      tool = {
        tool: 'bolt',
        globs: rootPackageJsonContent.bolt.workspaces,
      }
    }
  }

  const rootPackageJsonContent = await rootPackageJsonContentsPromise

  const packages: Packages = {
    root: {
      dir: '/',
      packageJson: rootPackageJsonContent,
    },
    tool: tool ? tool.tool : 'root',
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
    packages.packages.push(packages.root)
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- https://github.com/microsoft/TypeScript/issues/9998
  if (hasErrored) {
    throw new Error('an error occurred when fetching files')
  }

  const config = await configPromise.then(rawConfig =>
    parseConfig(rawConfig, packages),
  )

  const releasePlan = assembleReleasePlan(
    await Promise.all(changesetPromises),
    packages,
    config,
    await preStatePromise,
  )

  return {
    changedPackages: (packages.tool === 'root'
      ? packages.packages
      : packages.packages.filter(pkg =>
          changedFiles.some(changedFile => changedFile.includes(pkg.dir)),
        )
    )
      .filter(
        pkg =>
          pkg.packageJson.private !== true &&
          !config.ignore.includes(pkg.packageJson.name),
      )
      .map(x => x.packageJson.name),
    releasePlan,
  }
}
