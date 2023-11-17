import { Gitlab } from '@gitbeaker/rest'
import type { ProxyAgentConfigurationType } from 'global-agent'
import { bootstrap } from 'global-agent'

import { env } from './env.js'

const PROXY_PROPS = ['http_proxy', 'https_proxy', 'no_proxy'] as const

declare global {
  const GLOBAL_AGENT: {
    HTTP_PROXY: string | null
    HTTPS_PROXY: string | null
    NO_PROXY: string | null
  }
}

export const createApi = (gitlabToken?: string) => {
  bootstrap()

  for (const prop of PROXY_PROPS) {
    const uProp = prop.toUpperCase() as keyof ProxyAgentConfigurationType
    const value = process.env[uProp] || process.env[prop]
    if (value) {
      GLOBAL_AGENT[uProp] = value
    }
  }

  const token = gitlabToken || env.GITLAB_TOKEN
  const host = env.GITLAB_HOST

  // we cannot use { [tokenType]: token } now
  // because it will break the type of the Gitlab constructor
  switch (env.GITLAB_TOKEN_TYPE) {
    case 'job': {
      return new Gitlab({
        host,
        jobToken: token,
      })
    }
    case 'oauth': {
      return new Gitlab({
        host,
        oauthToken: token,
      })
    }
    default: {
      return new Gitlab({
        host,
        token,
      })
    }
  }
}
