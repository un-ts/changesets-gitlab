/// <reference path="../global.d.ts" />

import { Gitlab } from '@gitbeaker/rest'
import type { ProxyAgentConfigurationType } from 'global-agent'
import { bootstrap } from 'global-agent'

import { env } from './env.ts'

const PROXY_PROPS = ['http_proxy', 'https_proxy', 'no_proxy'] as const

let bootstrapped = false

export const createApi = (gitlabToken?: string) => {
  if (!bootstrapped) {
    bootstrapped = true

    bootstrap()

    for (const prop of PROXY_PROPS) {
      const uProp = prop.toUpperCase() as keyof ProxyAgentConfigurationType
      const value = process.env[uProp] || process.env[prop]
      if (value) {
        GLOBAL_AGENT[uProp] = value
      }
    }
  }

  const token = gitlabToken || env.GITLAB_TOKEN
  const host = env.GITLAB_HOST

  if (env.GITLAB_TOKEN_TYPE === 'oauth') {
    return new Gitlab({
      host,
      oauthToken: token,
    })
  }

  return new Gitlab({
    host,
    token,
  })
}
