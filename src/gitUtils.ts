import { exec } from '@actions/exec'

import { execWithOutput, identify } from './utils.js'

export const setupUser = async () => {
  await exec('git', [
    'config',
    '--global',
    'user.name',
    process.env.GITLAB_USER_NAME!,
  ])
  await exec('git', [
    'config',
    '--global',
    'user.email',
    process.env.GITLAB_CI_USER_EMAIL ||
      '"gitlab[bot]@users.noreply.gitlab.com"',
  ])
}

export const pullBranch = async (branch: string) => {
  await exec('git', ['pull', 'origin', branch])
}

export const push = async (
  branch: string,
  { force }: { force?: boolean } = {},
) => {
  await exec(
    'git',
    ['push', 'origin', `HEAD:${branch}`, force && '--force'].filter(identify),
  )
}

export const pushTags = async () => {
  await exec('git', ['push', 'origin', '--tags'])
}

export const switchToMaybeExistingBranch = async (branch: string) => {
  const { stdout, stderr } = await execWithOutput('git', ['checkout', branch], {
    ignoreReturnCode: true,
  })

  const shouldCreateBranch = !(
    stderr.toString().includes(`Switched to`) ||
    stdout.toString().includes(`Switched to`)
  )

  if (shouldCreateBranch) {
    await exec('git', ['checkout', '-b', branch])
  }
}

export const reset = async (
  pathSpec: string,
  mode: 'hard' | 'mixed' | 'soft' = 'hard',
) => {
  await exec('git', ['reset', `--${mode}`, pathSpec])
}

export const commitAll = async (message: string) => {
  await exec('git', ['add', '.'])
  await exec('git', ['commit', '-m', message])
}

export const checkIfClean = async (): Promise<boolean> => {
  const { stdout } = await execWithOutput('git', ['status', '--porcelain'])
  return stdout.length === 0
}
