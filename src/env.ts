import { setFailed } from '@actions/core'
import dotenv from 'dotenv'

import type { Env } from './types'
import { once } from './utils.js'

dotenv.config()

const gitlabTokenGetter = once(() => {
  if (!process.env.GITLAB_TOKEN) {
    setFailed('Please add the `GITLAB_TOKEN` to the changesets action')
  }
  return process.env.GITLAB_TOKEN ?? ''
})

export const env = {
  ...process.env,

  CI_MERGE_REQUEST_IID: +process.env.CI_MERGE_REQUEST_IID!,
  GITLAB_CI_USER_EMAIL:
    process.env.GITLAB_CI_USER_EMAIL || 'gitlab[bot]@users.noreply.gitlab.com',
  GITLAB_COMMENT_TYPE: process.env.GITLAB_COMMENT_TYPE ?? 'discussion',
  DEBUG_GITLAB_CREDENTIAL: process.env.DEBUG_GITLAB_CREDENTIAL ?? 'false',

  // only check for the token if we are explicitly using it
  // eslint-disable-next-line sonar/function-name
  get GITLAB_TOKEN() {
    return gitlabTokenGetter()
  },
} as Env
