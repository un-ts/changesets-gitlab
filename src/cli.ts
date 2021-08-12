#!/usr/bin/env node

import './env.js'

import { getInput, setFailed, setOutput } from '@actions/core'
import fs from 'fs-extra'

import { setupUser } from './gitUtils.js'
import readChangesetState from './readChangesetState.js'
import { runPublish, runVersion } from './run.js'

const main = async () => {
  const {
    CI,
    GITLAB_HOST = 'https://gitlab.com',
    GITLAB_TOKEN,
    HOME,
    NPM_TOKEN,
  } = process.env

  if (!GITLAB_TOKEN) {
    setFailed('Please add the GITLAB_TOKEN to the changesets action')
    return
  }

  setOutput('published', false)
  setOutput('publishedPackages', [])

  if (CI) {
    console.log('setting git user')
    await setupUser()

    console.log('setting GitHub credentials')
    await fs.writeFile(
      `${HOME!}/.netrc`,
      `machine ${GITLAB_HOST.replace(
        /^https?:\/\//,
        '',
      )}\nlogin gitlab[bot]\npassword ${GITLAB_TOKEN}`,
    )
  }

  const { changesets } = await readChangesetState()

  const publishScript = getInput('publish')
  const hasChangesets = changesets.length > 0
  const hasPublishScript = !!publishScript

  switch (true) {
    case !hasChangesets && !hasPublishScript:
      console.log('No changesets found')
      return
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
        gitlabToken: GITLAB_TOKEN,
      })

      if (result.published) {
        setOutput('published', true)
        setOutput('publishedPackages', result.publishedPackages)
      }
      return
    }
    case hasChangesets:
      await runVersion({
        script: getInput('version'),
        gitlabToken: GITLAB_TOKEN,
        prTitle: getInput('title'),
        commitMessage: getInput('commit'),
        hasPublishScript,
      })
  }
}

main().catch((err: Error) => {
  console.error(err)
  process.exit(1)
})
