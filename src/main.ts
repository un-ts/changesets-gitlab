import fs from 'node:fs'
import { URL } from 'node:url'

import { getInput, setFailed, setOutput, exportVariable } from '@actions/core'
import { exec } from '@actions/exec'

import { createApi } from './api.ts'
import { env } from './env.js'
import { setupUser } from './git-utils.js'
import readChangesetState from './read-changeset-state.js'
import { runPublish, runVersion } from './run.js'
import type { MainCommandOptions } from './types.js'
import {
  execSync,
  FALSY_VALUES,
  getOptionalInput,
  getUsername,
  TRUTHY_VALUES,
} from './utils.js'

export const main = async ({
  published,
  onlyChangesets,
}: MainCommandOptions = {}) => {
  const { GITLAB_TOKEN, NPM_TOKEN } = env

  setOutput('published', false)
  setOutput('publishedPackages', [])

  if (env.CI) {
    console.log('setting git user')
    await setupUser()

    const url = new URL(env.GITLAB_HOST)

    console.log('setting GitLab credentials')
    const username = await getUsername(createApi())

    await exec(
      'git',
      [
        'remote',
        'set-url',
        'origin',
        `${url.protocol}//${encodeURIComponent(username)}:${GITLAB_TOKEN}@${
          url.host
        }${url.pathname.replace(/\/$/, '')}/${env.CI_PROJECT_PATH}.git`,
      ],
      { silent: !TRUTHY_VALUES.has(env.DEBUG_GITLAB_CREDENTIAL!) },
    )
  }

  const { changesets } = await readChangesetState()

  const publishScript = getInput('publish')
  const hasChangesets = changesets.length > 0
  const hasPublishScript = !!publishScript

  switch (true) {
    case !hasChangesets && !hasPublishScript: {
      console.log('No changesets found')
      return
    }
    case !hasChangesets && hasPublishScript: {
      console.log(
        'No changesets found, attempting to publish any unpublished packages to npm',
      )

      const npmrcPath = `${env.HOME}/.npmrc`
      if (fs.existsSync(npmrcPath)) {
        console.log('Found existing .npmrc file')
      } else if (NPM_TOKEN) {
        console.log('No .npmrc file found, creating one')
        await fs.promises.writeFile(
          npmrcPath,
          `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`,
        )
      } else {
        setFailed(
          'No `.npmrc` found nor `NPM_TOKEN` provided, unable to publish packages',
        )
        return
      }

      const result = await runPublish({
        script: publishScript,
        gitlabToken: GITLAB_TOKEN,
        createGitlabReleases: !FALSY_VALUES.has(
          getInput('create_gitlab_releases'),
        ),
      })

      if (result.published) {
        setOutput('published', true)
        setOutput('publishedPackages', result.publishedPackages)
        exportVariable('PUBLISHED', true)
        exportVariable('PUBLISHED_PACKAGES', result.publishedPackages)
        if (published) {
          execSync(published)
        }
      }
      return
    }
    case hasChangesets: {
      await runVersion({
        script: getOptionalInput('version'),
        gitlabToken: GITLAB_TOKEN,
        mrTitle: getOptionalInput('title'),
        mrTargetBranch: getOptionalInput('target_branch'),
        commitMessage: getOptionalInput('commit'),
        removeSourceBranch: getInput('remove_source_branch') === 'true',
        hasPublishScript,
      })
      if (onlyChangesets) {
        execSync(onlyChangesets)
      }
    }
  }
}
