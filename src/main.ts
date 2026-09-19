import * as core from '@actions/core'
import { exec } from '@actions/exec'

import { env } from './env.js'
import { GitLab } from './gitlab.js'
import readChangesetState from './read-changeset-state.js'
import { type PublishResult, runPublish, runVersion } from './run.js'
import type { MainCommandOptions } from './types.js'
import {
  getBooleanInput,
  getCwdInput,
  getOptionalInput,
  setOutput,
  throwOnRemovedCommitModeInput,
  throwOnRenamedInputs,
  validateChangesetsCliVersion,
} from './utils.js'

export const main = async ({
  published,
  onlyChangesets,
}: MainCommandOptions = {}) => {
  const { GITLAB_TOKEN } = env

  const { absolute: cwd } = getCwdInput()

  await validateChangesetsCliVersion(cwd)

  // Inputs were renamed to match `changesets/action`. Both the old and the new
  // snake_case/kebab-case spellings normalize to the same `INPUT_*` variable
  // whenever they only differ by the separator, so only guard the ones that
  // actually moved to a different variable.
  throwOnRenamedInputs({
    publish: 'publish-script',
    version: 'version-script',
    commit: 'commit-message',
    title: 'pr-title',
    target_branch: 'pr-base-branch',
  })
  throwOnRemovedCommitModeInput()

  const pushWithGitCli = getBooleanInput('push-with-git-cli', true)

  const gitlab = new GitLab({ gitlabToken: GITLAB_TOKEN, cwd, pushWithGitCli })

  const { changesets } = await readChangesetState(cwd)

  const publishScript = getOptionalInput('publish-script')
  const hasChangesets = changesets.length > 0
  const hasNonEmptyChangesets = changesets.some(
    changeset => changeset.releases.length > 0,
  )
  const hasPublishScript = !!publishScript

  setOutput('published', false)
  setOutput('published-packages', [])
  setOutput('has-changesets', hasChangesets)

  switch (true) {
    case !hasChangesets && !hasPublishScript: {
      core.info(
        'No changesets present or were removed by merging version MR. Not publishing because publish-script is not set.',
      )
      return
    }
    case !hasChangesets && hasPublishScript: {
      core.info(
        'No changesets found. Attempting to publish any unpublished packages to npm',
      )

      const result = await runPublish({
        script: publishScript,
        gitlab,
        ...getPublishFlags(),
        cwd,
      })

      await handlePublishResult(result, published)
      return
    }
    case hasChangesets && !hasNonEmptyChangesets: {
      core.info('All changesets are empty. Not creating MR')
      return
    }
    case hasChangesets: {
      const { pullRequestNumber } = await runVersion({
        script: getOptionalInput('version-script'),
        gitlab,
        cwd,
        mrTitle: getOptionalInput('pr-title'),
        commitMessage: getOptionalInput('commit-message'),
        hasPublishScript,
        prDraft: getPrDraftInput(),
        mrTargetBranch: getOptionalInput('pr-base-branch'),
        removeSourceBranch: getBooleanInput('remove-source-branch'),
      })
      if (onlyChangesets) {
        await exec(onlyChangesets)
      }
      if (pullRequestNumber !== undefined) {
        setOutput('pr-number', pullRequestNumber)
      }
      return
    }
  }
}

export function getPrDraftInput(): 'always' | 'create' | undefined {
  const prDraft = getOptionalInput('pr-draft')
  if (prDraft !== undefined && prDraft !== 'always' && prDraft !== 'create') {
    throw new Error(`Invalid pr-draft input: ${prDraft}`)
  }
  return prDraft
}

export function getPublishFlags() {
  const createGitlabReleases = getBooleanInput('create-gitlab-releases', true)
  const pushGitTags = getBooleanInput('push-git-tags', true)
  if (createGitlabReleases && !pushGitTags) {
    throw new Error(
      'The input "create-gitlab-releases" is set to true, but "push-git-tags" is set to false. ' +
        'Creating GitLab releases requires pushing git tags. Please set "push-git-tags" to true ' +
        'or set "create-gitlab-releases" to false.',
    )
  }
  return { createGitlabReleases, pushGitTags }
}

// GitLab counterpart of the `if (result.published)`/`if (result.exitCode !== 0)`
// blocks in `changesets/action`'s `src/index.ts`. As well as the
// GitHub-compatible outputs it runs the optional post-publish command with
// `PUBLISHED`/`PUBLISHED_PACKAGES` set, which is a GitLab-only feature.
export async function handlePublishResult(
  result: PublishResult,
  published?: string,
) {
  if (result.published) {
    setOutput('published', true)
    setOutput('published-packages', result.publishedPackages)
    if (published) {
      await exec(published, undefined, {
        env: {
          ...process.env,
          PUBLISHED: 'true',
          PUBLISHED_PACKAGES: JSON.stringify(result.publishedPackages),
        },
      })
    }
  }

  if (result.exitCode !== 0) {
    throw new Error(
      `Publish command exited with code ${result.exitCode}${
        result.published
          ? `, but some packages were published: ${result.publishedPackages
              .map(p => `${p.name}@${p.version}`)
              .join(', ')}`
          : ''
      }`,
    )
  }
}
