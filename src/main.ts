import { URL } from 'url'

import { getInput, setFailed, setOutput } from '@actions/core'
import fs from 'fs-extra'
import { exec } from '@actions/exec'

import { setupUser } from './gitUtils.js'
import readChangesetState from './readChangesetState.js'
import { runPublish, runVersion } from './run.js'
import { MainCommandOptions } from './types.js'
import { execSync } from './utils.js'

export const main = async ({
  published,
  onlyChangesets,
}: MainCommandOptions = {}) => {
  const {
    CI,
    CI_PROJECT_PATH,
    GITLAB_HOST = 'https://gitlab.com',
    GITLAB_CI_USER_NAME,
    GITLAB_TOKEN,
    HOME,
    NPM_TOKEN,
  } = process.env

  setOutput('published', false)
  setOutput('publishedPackages', [])

  if (CI) {
    console.log('setting git user')
    await setupUser()

    console.log('setting GitLab credentials')

    const url = new URL(GITLAB_HOST)

    await exec('git', [
      'remote',
      'set-url',
      'origin',
      `${url.protocol}//${GITLAB_CI_USER_NAME!}:${GITLAB_TOKEN!}@${
        url.host
      }/${CI_PROJECT_PATH!}.git`,
    ])
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

      const npmrcPath = `${HOME!}/.npmrc`
      if (fs.existsSync(npmrcPath)) {
        console.log('Found existing .npmrc file')
      } else if (NPM_TOKEN) {
        console.log('No .npmrc file found, creating one')
        fs.writeFileSync(
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
        gitlabToken: GITLAB_TOKEN!,
      })

      if (result.published) {
        setOutput('published', true)
        setOutput('publishedPackages', result.publishedPackages)
        if (published) {
          execSync(published)
        }
      }
      return
    }
    case hasChangesets: {
      await runVersion({
        script: getInput('version'),
        gitlabToken: GITLAB_TOKEN!,
        prTitle: getInput('title'),
        commitMessage: getInput('commit'),
        hasPublishScript,
      })
      if (onlyChangesets) {
        execSync(onlyChangesets)
      }
    }
  }
}
