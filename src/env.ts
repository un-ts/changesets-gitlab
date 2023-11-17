import { setFailed } from '@actions/core'
import dotenv from 'dotenv'

import type { Env } from './env.types'

const prepareEnv = () => {
  dotenv.config()

  if (!process.env.GITLAB_TOKEN) {
    setFailed('Please add the `GITLAB_TOKEN` to the changesets action')
  }

  const env = { ...process.env }
  env.GITLAB_CI_USER_EMAIL ??= '"gitlab[bot]@users.noreply.gitlab.com"'

  env.GITLAB_COMMENT_TYPE ??= 'discussion'
  env.DEBUG_GITLAB_CREDENTIAL ??= 'false'

  return env as Env
}

export const env = prepareEnv()
