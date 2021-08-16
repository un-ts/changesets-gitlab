#!/usr/bin/env node

import './env.js'

import { setFailed } from '@actions/core'

import { comment } from './comment.js'
import { main } from './main.js'

const cli = async () => {
  const { GITLAB_CI_USER_NAME, GITLAB_TOKEN } = process.env

  if (!GITLAB_TOKEN || !GITLAB_CI_USER_NAME) {
    setFailed(
      'Please add the `GITLAB_TOKEN` and `GITLAB_CI_USER_NAME` to the changesets action',
    )
    return
  }

  return ['-c', '--comment'].includes(process.argv[2]) ? comment() : main()
}

cli().catch((err: Error) => {
  console.error(err)
  process.exit(1)
})
