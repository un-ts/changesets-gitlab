---
"changesets-gitlab": major
---

Drop support for Changesets v2 and Node < 22. Bump all `@changesets/*` dependencies to v3 and `@manypkg/get-packages` to v3.

Breaking changes:

- **Node engine requirement** bumped from `>=18.0.0` to `^22.11 || ^24 || >=26` to match Changesets v3
- **`@changesets/*` dependencies** bumped to v3 versions, which are ESM-only
- **`@manypkg/get-packages`** bumped to v3, changing the `Packages` and `Package` types (`tool` is now an object with `type` property, `root` renamed to `rootPackage`, `Package` now requires `relativeDir`)

Bug fixes for Changesets v3 compatibility:

- Handle the new `changeset version` exit code 1 when no unreleased changesets exist
- Detect published packages via the `CHANGESETS_OUTPUT` env var (NDJSON format), falling back to stdout "New tag:" parsing for Changesets v2
- Prevent creating empty release MRs when the version command produces no file changes — fall through to publish instead
- Use `ignoreReturnCode: true` on version and publish commands since v3 may exit non-zero in valid scenarios
