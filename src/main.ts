import fs from 'node:fs/promises'
import { URL } from 'node:url'

import { exportVariable, getInput, setOutput } from '@actions/core'
import { exec } from '@actions/exec'

import { createApi } from './api.ts'
import { env } from './env.js'
import { setupUser } from './git-utils.js'
import readChangesetState from './read-changeset-state.js'
import { runPublish, runVersion } from './run.js'
import type { MainCommandOptions } from './types.js'
import {
  FALSY_VALUES,
  TRUTHY_VALUES,
  execSync,
  fileExists,
  getOptionalInput,
  getUsername,
} from './utils.js'

export const main = async ({
  published,
  onlyChangesets,
  // eslint-disable-next-line sonarjs/cognitive-complexity
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

      if (NPM_TOKEN) {
        const userNpmrcPath = `${env.HOME}/.npmrc`
        if (await fileExists(userNpmrcPath)) {
          console.info('Found existing user .npmrc file')
          const userNpmrcContent = await fs.readFile(userNpmrcPath, 'utf8')
          const authLine = userNpmrcContent.split('\n').find(line => {
            // check based on https://github.com/npm/cli/blob/8f8f71e4dd5ee66b3b17888faad5a7bf6c657eed/test/lib/adduser.js#L103-L105
            return /^\s*\/\/registry\.npmjs\.org\/:[_-]authToken=/i.test(line)
          })
          if (authLine) {
            console.info(
              'Found existing auth token for the npm registry in the user .npmrc file',
            )
          } else {
            console.info(
              "Didn't find existing auth token for the npm registry in the user .npmrc file, creating one",
            )
            await fs.appendFile(
              userNpmrcPath,
              `\n//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n`,
            )
          }
        } else {
          console.info(
            'No user .npmrc file found, creating one with NPM_TOKEN used as auth token',
          )
          await fs.writeFile(
            userNpmrcPath,
            `//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n`,
          )
        }
      } else {
        console.info(
          'No NPM_TOKEN found - assuming trusted publishing or npm is already authenticated',
        )
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
