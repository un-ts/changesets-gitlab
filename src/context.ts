// Simulate context in GitHub Actions

export const projectId = process.env.CI_PROJECT_ID!

export const ref = process.env.CI_COMMIT_REF_NAME!

export const sha = process.env.CI_COMMIT_SHA!
