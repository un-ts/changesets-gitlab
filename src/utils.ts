import { writeFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

import * as core from '@actions/core'
import {
  exec,
  getExecOutput,
  type ExecOptions as ActionsExecOptions,
} from '@actions/exec'
import {
  type CommitAction,
  type Gitlab,
  GitbeakerRequestError,
} from '@gitbeaker/rest'
import type { Package } from '@manypkg/get-packages'
import { getPackages } from '@manypkg/get-packages'
import { toString as mdastToString } from 'mdast-util-to-string'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import major from 'semver/functions/major.js'
import subset from 'semver/ranges/subset.js'
import { unified } from 'unified'

import type { GitLabApi } from './api.js'
import { FALSY_VALUES, TRUTHY_VALUES } from './constants.js'
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
      if (endIndex === undefined && headingStartInfo?.depth === node.depth) {
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

export async function getAllFiles(dir: string, base = dir): Promise<string[]> {
  dir ||= '.'
  const direntList = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/await-thenable
    direntList.map(dirent => {
      const res = path.resolve(dir, dirent.name)
      return dirent.isDirectory()
        ? getAllFiles(res, base)
        : [path.relative(base, res)]
    }),
  )
  return files.flat()
}

// GitLab counterpart of `@changesets/ghcommit`'s `commitChangesSinceBase` used
// by `changesets/action` in API push mode: derive the file changes since the
// base commit and commit them through the GitLab API.
export async function commitChangesSinceBase({
  api,
  projectId,
  branch,
  message,
  base,
  force,
  cwd,
}: {
  api: GitLabApi
  projectId: number | string
  branch: string
  message: string
  base: { commit: string }
  force: boolean
  cwd: string
}) {
  const actions = await getCommitActions(cwd, base.commit)
  if (actions.length === 0) {
    return
  }
  await api.Commits.create(projectId, branch, message, actions, {
    startSha: base.commit,
    force,
  })
}

async function getCommitActions(
  cwd: string,
  baseCommit: string,
): Promise<CommitAction[]> {
  const { stdout: gitRoot } = await getExecOutput(
    'git',
    ['rev-parse', '--show-toplevel'],
    { cwd },
  )
  // `git diff` paths are relative to the repository root, while `ls-files`
  // needs `--full-name` to match; both are scoped to `cwd`.
  const { stdout: diffOutput } = await getExecOutput(
    'git',
    ['diff', '--name-status', '--no-renames', baseCommit, '--', '.'],
    { cwd },
  )
  const { stdout: untrackedOutput } = await getExecOutput(
    'git',
    ['ls-files', '--others', '--exclude-standard', '--full-name', '--', '.'],
    { cwd },
  )

  const rootDir = gitRoot.trim()
  const actions: CommitAction[] = []
  const seen = new Set<string>()

  const addAction = async (
    filePath: string,
    action: CommitAction['action'],
  ) => {
    if (seen.has(filePath)) {
      return
    }
    seen.add(filePath)
    if (action === 'delete') {
      actions.push({ action, filePath })
    } else {
      const content = await fs.readFile(
        path.resolve(rootDir, filePath),
        'base64',
      )
      actions.push({ action, filePath, content, encoding: 'base64' })
    }
  }

  for (const line of diffOutput.split('\n')) {
    if (!line) {
      continue
    }
    const [status, filePath] = line.split('\t')
    if (!filePath) {
      continue
    }
    let action: CommitAction['action'] = 'update'
    if (status === 'A') {
      action = 'create'
    } else if (status === 'D') {
      action = 'delete'
    }
    await addAction(filePath, action)
  }

  for (const filePath of untrackedOutput.split('\n')) {
    if (filePath) {
      await addAction(filePath, 'create')
    }
  }

  return actions
}

// GitLab CI/CD variable names cannot contain hyphens, so kebab-case input names
// (matching `changesets/action`) are read from their underscore-normalized
// `INPUT_*` variables.
const normalizeInputName = (name: string) => name.replaceAll('-', '_')

const toInputEnvName = (name: string) =>
  `INPUT_${normalizeInputName(name).toUpperCase()}`

export const getOptionalInput = (name: string) =>
  core.getInput(normalizeInputName(name)) || undefined

export function getRequiredInput(name: string) {
  // it's just a small utility wrapper, mainly introduced for usage parity with our custom `getOptionalInput`
  return core.getInput(normalizeInputName(name), { required: true })
}

// GitLab has no `action.yml` to declare input defaults, so fall back to
// `defaultValue` when the input is unset instead of throwing like
// `core.getBooleanInput` would.
export function getBooleanInput(name: string, defaultValue = false) {
  const normalizedName = normalizeInputName(name)
  const value = core.getInput(normalizedName)
  if (!value) {
    return defaultValue
  }
  // The sets cover the YAML 1.2 boolean spellings plus the GitLab-style
  // `1`/`0` that `core.getBooleanInput` rejects, and are case-sensitive.
  if (TRUTHY_VALUES.has(value)) {
    return true
  }
  if (FALSY_VALUES.has(value)) {
    return false
  }
  return core.getBooleanInput(normalizedName)
}

let ensuredOutputFile: string | undefined

// GitLab has no `@actions/core` outputs, so fall back to
// `~/.changesets-gitlab.outputs` so later steps can read the values. Set
// `$GITHUB_OUTPUT` to an empty string to opt out of the fallback.
export function setOutput(name: string, value: unknown) {
  const outputFile = (process.env.GITHUB_OUTPUT ??= path.join(
    os.homedir(),
    '.changesets-gitlab.outputs',
  ))
  if (outputFile && ensuredOutputFile !== outputFile) {
    ensuredOutputFile = outputFile
    // `@actions/core` requires the output file to already exist; `a` creates it
    // without truncating values written by earlier CLI runs.
    writeFileSync(outputFile, '', { flag: 'a' })
  }
  core.setOutput(name, value)
}

export const getCwdInput = (): { relative: string; absolute: string } => {
  const CWD = process.cwd()
  const input = getOptionalInput('cwd')
  if (!input) {
    return { relative: '', absolute: CWD }
  }
  const absolute = path.resolve(CWD, input)
  const relative = path.relative(CWD, absolute)
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Invalid cwd input: "${input}"`)
  }
  return { relative, absolute }
}

const usernameCache = new WeakMap<Gitlab, Promise<string>>()

export const getUsername = (api: Gitlab) => {
  const cached = usernameCache.get(api)
  if (cached) {
    return cached
  }
  const usernamePromise = Promise.resolve(
    env.GITLAB_CI_USER_NAME ??
      api.Users.showCurrentUser().then(currentUser => currentUser.username),
  )
  usernameCache.set(api, usernamePromise)
  return usernamePromise
}

export const cjsRequire =
  typeof require === 'undefined' ? createRequire(import.meta.url) : require

export function isErrorWithCode(err: unknown, code: string) {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === code
  )
}

export async function logGitbeakerError(err: unknown) {
  if (err instanceof GitbeakerRequestError && err.cause) {
    const { description, request, response } = err.cause
    core.error(description)
    try {
      core.error(`request: ${await request.text()}`)
    } catch {
      core.error("The error's request could not be used as plain text")
    }
    try {
      core.error(`response: ${await response.text()}`)
    } catch {
      core.error("The error's response could not be used as plain text")
    }
  }
}

export function throwOnRemovedCommitModeInput() {
  for (const inputName of ['commit-mode', 'commitMode']) {
    const value = getOptionalInput(inputName)
    if (value === undefined) {
      continue
    }

    const envName = toInputEnvName(inputName)
    const pushWithGitCliEnv = toInputEnvName('push-with-git-cli')
    const migration =
      value === 'git-cli'
        ? `Replace it with "${pushWithGitCliEnv}=true".`
        : `Set "${pushWithGitCliEnv}" to true for Git CLI pushes or false for GitLab API pushes.`
    throw new Error(
      `The "${envName}" environment variable has been replaced by "${pushWithGitCliEnv}". ${migration}`,
    )
  }
}

export function throwOnRenamedInputs(renames: Record<string, string>) {
  const references: Record<string, string> = {}

  for (const [oldInput, newInput] of Object.entries(renames)) {
    if (getOptionalInput(oldInput)) {
      references[oldInput] = newInput
    }
  }

  if (Object.keys(references).length > 0) {
    const list = Object.entries(references)
      .map(
        ([oldInput, newInput]) =>
          `- "${toInputEnvName(oldInput)}" -> "${toInputEnvName(newInput)}"`,
      )
      .join('\n')
    throw new Error(
      `The following environment variables have been renamed:\n${list}\nPlease update your CI configuration.`,
    )
  }
}

const changesetsCliCompatibilityError =
  'This version of changesets-gitlab is designed to work with Changesets CLI v3. ' +
  'Changesets CLI v2 is not supported; use changesets-gitlab v0.14 or earlier instead.'

export async function validateChangesetsCliVersion(cwd: string) {
  const { rootPackage } = await getPackages(cwd)
  const packageJson = rootPackage?.packageJson
  const declaredVersion =
    packageJson?.devDependencies?.['@changesets/cli'] ??
    packageJson?.dependencies?.['@changesets/cli']

  if (typeof declaredVersion === 'string') {
    const range = declaredVersion.startsWith('workspace:')
      ? declaredVersion.slice('workspace:'.length)
      : declaredVersion

    let isV2 = false

    try {
      isV2 = subset(range, '>=2.0.0-0 <3.0.0-0', {
        includePrerelease: true,
      })
    } catch {
      // it could be a non-semver protocol
    }

    if (isV2) {
      throw new Error(changesetsCliCompatibilityError)
    }
  }

  let cliPackageJson: { version?: string }

  try {
    cliPackageJson = cjsRequire(
      cjsRequire.resolve('@changesets/cli/package.json', { paths: [cwd] }),
    ) as { version?: string }
  } catch {
    return
  }

  if (
    typeof cliPackageJson.version === 'string' &&
    major(cliPackageJson.version) === 2
  ) {
    throw new Error(changesetsCliCompatibilityError)
  }
}

function resolveChangesetsCli(cwd: string) {
  return cjsRequire.resolve('@changesets/cli/bin.js', {
    paths: [cwd],
  })
}

interface ExecOptions extends Omit<ActionsExecOptions, 'env'> {
  env?: Record<string, string | undefined>
}

export function execChangesetsCli(args: string[], options?: ExecOptions) {
  return exec(
    'node',
    [resolveChangesetsCli(options?.cwd ?? process.cwd()), ...args],
    options as ActionsExecOptions,
  )
}

export function getExecOutputChangesetsCli(
  args: string[],
  options?: ExecOptions,
) {
  return getExecOutput(
    'node',
    [resolveChangesetsCli(options?.cwd ?? process.cwd()), ...args],
    options as ActionsExecOptions,
  )
}
