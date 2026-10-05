const TOKEN_REGEX = /\{(\w+)\}/g

const RELEASE_LINE_TOKENS = [
  'summary',
  'ref',
  'pull',
  'mr',
  'commit',
  'authors',
] as const

export interface ReleaseLineLinks {
  commit?: string
  mr?: string
  user?: string
}

export interface ReleaseLineTokens {
  summary: string
  ref: string
  pull: string
  mr: string
  commit: string
  authors: string
}

export const renderTemplate = (template: string, tokens: ReleaseLineTokens) =>
  template.replaceAll(TOKEN_REGEX, (_match, name: string) => {
    if (!Object.hasOwn(tokens, name)) {
      throw new Error(
        `Unknown changelog template token "{${name}}". Valid tokens are: ${RELEASE_LINE_TOKENS.map(
          token => `{${token}}`,
        ).join(', ')}.`,
      )
    }
    return tokens[name as keyof ReleaseLineTokens]
  })

const getRef = ({ mr, commit }: ReleaseLineLinks) => {
  if (mr) {
    return `(${mr})`
  }
  if (commit) {
    return `(${commit})`
  }
  return ''
}

export const buildReleaseLineTokens = ({
  summaryLinked,
  links,
  users,
}: {
  summaryLinked: string
  links: ReleaseLineLinks
  users: string | null | undefined
}): ReleaseLineTokens => ({
  summary: summaryLinked,
  ref: getRef(links),
  pull: links.mr ?? '',
  mr: links.mr ?? '',
  commit: links.commit ?? '',
  authors: users ?? '',
})
