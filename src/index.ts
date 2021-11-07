import { Gitlab } from '@gitbeaker/node'
import { bootstrap, ProxyAgentConfigurationType } from 'global-agent'

const PROXY_PROPS = ['http_proxy', 'https_proxy', 'no_proxy'] as const

declare global {
  const GLOBAL_AGENT: {
    HTTP_PROXY: string | null
    HTTPS_PROXY: string | null
    NO_PROXY: string | null
  }
}

type ConstructorArgs<T> = T extends new (...args: infer U) => any ? U : never
type GitlabConfig = ConstructorArgs<typeof Gitlab>[0]

export const createApi = (gitlabToken?: string) => {
  bootstrap()

  for (const prop of PROXY_PROPS) {
    const uProp = prop.toUpperCase() as keyof ProxyAgentConfigurationType
    const value = process.env[uProp] || process.env[prop]
    if (value) {
      GLOBAL_AGENT[uProp] = value
    }
  }

  const config: GitlabConfig = {
    host: process.env.GITLAB_HOST,
  }

  const token = gitlabToken || process.env.GITLAB_TOKEN

  switch (process.env.GITLAB_TOKEN_TYPE) {
    case 'job':
      config.jobToken = token
      break
    case 'oauth':
      config.oauthToken = token
      break
    default:
      config.token = token
      break
  }

  return new Gitlab(config)
}
