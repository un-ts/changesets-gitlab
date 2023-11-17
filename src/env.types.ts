export type Env = GitLabCIPredefinedVariables &
  MergeRequestVariables & {
    GITLAB_HOST: string

    GITLAB_TOKEN: string
    GITLAB_TOKEN_TYPE: LooseString<'job' | 'oauth'>
    GITLAB_CI_USER_NAME: string | undefined
    GITLAB_CI_USER_EMAIL: string
    GITLAB_COMMENT_TYPE: LooseString<'discussion' | 'note'>
    DEBUG_GITLAB_CREDENTIAL: LooseString<'1' | 'true'>

    HOME: string
    NPM_TOKEN: string | undefined
  }

type MergeRequestVariables =
  | {
      // this is used to be checked if the current job is a merge request job
      CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: undefined
    }
  | {
      CI_MERGE_REQUEST_IID: number
      CI_MERGE_REQUEST_PROJECT_URL: string
      CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: string
      CI_MERGE_REQUEST_SOURCE_BRANCH_SHA: string
      CI_MERGE_REQUEST_TITLE: string
    }

type GitLabCIPredefinedVariables = { GITLAB_USER_NAME: string } & (
  | {
      // this is used to be checked if the current job is a merge request job
      CI: undefined
    }
  | {
      CI: 'true'
      CI_PROJECT_PATH: string
      CI_SERVER_URL: string
    }
)

// This type represents a couple of possible literal values for a string, but also
// allows any other string value. It's useful for environment variables that can
// have a default value, but can also be overridden by the user.
// The weird `string & {}` is to make sure that the type is not narrowed to `string`
// See: https://twitter.com/mattpocockuk/status/1671908303918473217
// eslint-disable-next-line @typescript-eslint/ban-types, sonar/no-useless-intersection
type LooseString<T extends string> = T | (string & {})
