import { env } from './env.js'
import { GitLab } from './gitlab.js'
import { getPrDraftInput } from './main.js'
import { runVersion } from './run.js'
import {
  getBooleanInput,
  getCwdInput,
  getOptionalInput,
  setOutput,
  throwOnRemovedCommitModeInput,
  throwOnRenamedInputs,
  validateChangesetsCliVersion,
} from './utils.js'

/**
 * GitLab command counterpart of the `changesets/action` `/version` sub-action.
 * Runs only the version step, so it can be used in a split release pipeline.
 */
export const version = async (): Promise<void> => {
  const { absolute: cwd } = getCwdInput()
  await validateChangesetsCliVersion(cwd)
  throwOnRemovedCommitModeInput()
  throwOnRenamedInputs({
    version: 'version-script',
    title: 'pr-title',
    commit: 'commit-message',
    target_branch: 'pr-base-branch',
  })

  const gitlab = new GitLab({
    gitlabToken: env.GITLAB_TOKEN,
    cwd,
    pushWithGitCli: getBooleanInput('push-with-git-cli', true),
  })

  const { pullRequestNumber } = await runVersion({
    script: getOptionalInput('version-script'),
    gitlab,
    cwd,
    mrTitle: getOptionalInput('pr-title'),
    commitMessage: getOptionalInput('commit-message'),
    // The split version command has no knowledge of a later publish step.
    hasPublishScript: true,
    prDraft: getPrDraftInput(),
    mrTargetBranch: getOptionalInput('pr-base-branch'),
    removeSourceBranch: getBooleanInput('remove-source-branch'),
  })

  if (pullRequestNumber !== undefined) {
    setOutput('pr-number', pullRequestNumber)
  }
}
