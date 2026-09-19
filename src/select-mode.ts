import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import * as core from '@actions/core'

import readChangesetState from './read-changeset-state.js'
import {
  execChangesetsCli,
  getCwdInput,
  getOptionalInput,
  setOutput,
  validateChangesetsCliVersion,
} from './utils.js'

type ModeResult =
  | { mode: 'none' }
  | { mode: 'publish'; publishPlanPath: string }
  | { mode: 'version' }

type PublishPlan = unknown[]

/**
 * GitLab command counterpart of the `changesets/action` `/select-mode`
 * sub-action. Instead of uploading the publish plan as a GitHub artifact, it
 * exports its filesystem path so it can be reused (for example through GitLab
 * CI artifacts) by the `pack` and `publish` commands.
 */
export const selectMode = async (): Promise<void> => {
  const { absolute: cwd } = getCwdInput()
  await validateChangesetsCliVersion(cwd)

  const result = await getMode(cwd)
  setOutput('mode', result.mode)
  core.info(`Select mode: ${result.mode}`)

  if (result.mode === 'publish') {
    setOutput('publish-plan-path', result.publishPlanPath)
    core.info(`Publish plan: ${result.publishPlanPath}`)
  }
}

async function getMode(cwd: string): Promise<ModeResult> {
  const { changesets } = await readChangesetState(cwd)

  if (changesets.length > 0) {
    const hasNonEmptyChangesets = changesets.some(
      changeset => changeset.releases.length > 0,
    )
    return { mode: hasNonEmptyChangesets ? 'version' : 'none' }
  }

  const configuredPublishPlanPath = getOptionalInput('publish-plan-path')
  const publishPlanPath = configuredPublishPlanPath
    ? // resolve against `cwd`, the Changesets CLI writes the file relative to it
      path.resolve(cwd, configuredPublishPlanPath)
    : path.join(
        os.tmpdir(),
        `changeset-publish-plan-${Date.now()}`,
        // we need a stable filename here (in a unique dirname) so the publish
        // command can find this cleanly
        'publish-plan.json',
      )
  await execChangesetsCli(['publish-plan', '--output', publishPlanPath], {
    cwd,
    env: process.env,
  })

  const publishPlan = await readPublishPlan(publishPlanPath)
  if (publishPlan.length === 0) {
    return { mode: 'none' }
  }

  return { mode: 'publish', publishPlanPath }
}

async function readPublishPlan(publishPlanPath: string): Promise<PublishPlan> {
  let rawPlan: string
  try {
    rawPlan = await fs.readFile(publishPlanPath, 'utf8')
  } catch (err) {
    throw new Error(`Failed to read publish plan at ${publishPlanPath}`, {
      cause: err,
    })
  }

  let plan: unknown
  try {
    plan = JSON.parse(rawPlan)
  } catch (err) {
    throw new Error(`Failed to parse publish plan at ${publishPlanPath}`, {
      cause: err,
    })
  }

  if (
    typeof plan !== 'object' ||
    plan === null ||
    !('version' in plan) ||
    typeof plan.version !== 'number' ||
    !('plan' in plan) ||
    !Array.isArray(plan.plan)
  ) {
    throw new Error(
      `Invalid publish plan at ${publishPlanPath}: expected { version: number; plan: unknown[] }`,
    )
  }
  return plan.plan as unknown[]
}
