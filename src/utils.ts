import { execSync as _execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { getInput } from '@actions/core'
import { exec } from '@actions/exec'
import type { Gitlab } from '@gitbeaker/core'
import type { Package } from '@manypkg/get-packages'
import { getPackages } from '@manypkg/get-packages'
import { toString as mdastToString } from 'mdast-util-to-string'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'

export const BumpLevels = {
  dep: 0,
  patch: 1,
  minor: 2,
  major: 3,
} as const

export async function getVersionsByDirectory(cwd: string) {
  const { packages } = await getPackages(cwd)
  return new Map(packages.map(x => [x.dir, x.packageJson.version]))
}

export async function getChangedPackages(
  cwd: string,
  previousVersions: Map<string, string>,
) {
  const { packages } = await getPackages(cwd)
  const changedPackages = new Set<Package>()

  for (const pkg of packages) {
    const previousVersion = previousVersions.get(pkg.dir)
    if (previousVersion !== pkg.packageJson.version) {
      changedPackages.add(pkg)
    }
  }

  return [...changedPackages]
}

export function getChangelogEntry(changelog: string, version: string) {
  const ast = unified().use(remarkParse).parse(changelog)

  let highestLevel: number = BumpLevels.dep

  const nodes = ast.children
  let headingStartInfo:
    | {
        index: number
        depth: number
      }
    | undefined
  let endIndex: number | undefined

  for (const [i, node] of nodes.entries()) {
    if (node.type === 'heading') {
      const stringified = mdastToString(node)
      const match = /(major|minor|patch)/.exec(stringified.toLowerCase())
      if (match !== null) {
        const level = BumpLevels[match[0] as 'major' | 'minor' | 'patch']
        highestLevel = Math.max(level, highestLevel)
      }
      if (headingStartInfo === undefined && stringified === version) {
        headingStartInfo = {
          index: i,
          depth: node.depth,
        }
        continue
      }
      if (
        endIndex === undefined &&
        headingStartInfo !== undefined &&
        headingStartInfo.depth === node.depth
      ) {
        endIndex = i
        break
      }
    }
  }
  if (headingStartInfo) {
    ast.children = ast.children.slice(headingStartInfo.index + 1, endIndex)
  }
  return {
    content: unified().use(remarkStringify).stringify(ast),
    highestLevel,
  }
}

export async function execWithOutput(
  command: string,
  args?: string[],
  options?: { ignoreReturnCode?: boolean; cwd?: string },
) {
  let myOutput = ''
  let myError = ''

  return {
    code: await exec(command, args, {
      listeners: {
        stdout: (data: Buffer) => {
          myOutput += data.toString()
        },
        stderr: (data: Buffer) => {
          myError += data.toString()
        },
      },
      ...options,
    }),
    stdout: myOutput,
    stderr: myError,
  }
}

export function sortTheThings(
  a: { private: boolean; highestLevel: number },
  b: { private: boolean; highestLevel: number },
) {
  if (a.private === b.private) {
    return b.highestLevel - a.highestLevel
  }
  if (a.private) {
    return 1
  }
  return -1
}

export const identify = <T>(
  _: T,
): _ is Exclude<
  T,
  '' | (T extends boolean ? false : boolean) | null | undefined
> => !!_

export async function getAllFiles(dir: string, base = dir): Promise<string[]> {
  const direntList = await fs.promises.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    direntList.map(dirent => {
      const res = path.resolve(dir, dirent.name)
      return dirent.isDirectory()
        ? getAllFiles(res, base)
        : [path.relative(base, res)]
    }),
  )
  return files.flat()
}

export const execSync = (command: string) =>
  _execSync(command, {
    stdio: 'inherit',
  })

export const getOptionalInput = (name: string) => getInput(name) || undefined

export const getUsername = async (api: Gitlab) => {
  return process.env.GITLAB_CI_USER_NAME == null
    ? await api.Users.current().then(currentUser => currentUser.username)
    : process.env.GITLAB_CI_USER_NAME
}

export const checkPublishConfig = (): boolean => {
  const { HOME, NPM_TOKEN } = process.env

  const projectNpmrcPath = './.npmrc'
  const userNpmrcPath = `${HOME!}/.npmrc`

  if (fs.existsSync(projectNpmrcPath)) {
    console.log('Found existing .npmrc file in project directory')
  } else if (fs.existsSync(userNpmrcPath)) {
    console.log('Found existing .npmrc file in home directory')
  } else if (NPM_TOKEN) {
    console.log('No .npmrc file found, creating one')
    fs.writeFileSync(
      projectNpmrcPath,
      `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`,
    )
  } else {
    return false
  }

  return true
}
