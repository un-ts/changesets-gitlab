import { execSync as execSync_ } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
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

import { env } from './env.js'

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
    ast.children = ast.children.slice(
      headingStartInfo.index + 1,
      // eslint-disable-next-line sonarjs/argument-type
      endIndex,
    )
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
    // eslint-disable-next-line sonarjs/function-return-type
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
  // eslint-disable-next-line sonarjs/os-command
  execSync_(command, { stdio: 'inherit' })

export const getOptionalInput = (name: string) => getInput(name) || undefined

// eslint-disable-next-line sonarjs/function-return-type
export const getUsername = (api: Gitlab) => {
  return (
    env.GITLAB_CI_USER_NAME ??
    api.Users.showCurrentUser().then(currentUser => currentUser.username)
  )
}

export const cjsRequire =
  typeof require === 'undefined' ? createRequire(import.meta.url) : require

export const FALSY_VALUES = new Set(['false', '0'])

export const TRUTHY_VALUES = new Set(['true', '1'])

export const GITLAB_MAX_TAGS = 4

export const HTTP_STATUS_NOT_FOUND = 404
