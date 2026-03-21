// Simulate context in GitHub Actions
/** biome-ignore-all lint/style/noNonNullAssertion: fix later */

export const projectId = process.env.CI_PROJECT_ID!

export const ref = process.env.CI_COMMIT_REF_NAME!
