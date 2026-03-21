---
"@dvashim/changesets-gitlab": patch
---

Fork and modernize project tooling

- **Build:** Migrate from yarn/eslint/prettier to pnpm/biome
- **Build:** Inline tsconfig base and update all dependencies
- **Style:** Apply biome formatting and remove eslint-disable comments
- **CI:** Rewrite workflows for pnpm with matrix strategy, fix concurrency and timeout issues
- **Chore:** Update fork identity, license, and README metadata
- **Docs:** Add CLAUDE.md with project instructions
