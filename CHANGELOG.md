# changesets-gitlab

## 0.13.4

### Patch Changes

- [#223](https://github.com/un-ts/changesets-gitlab/pull/223) [`9ab4bb0`](https://github.com/un-ts/changesets-gitlab/commit/9ab4bb0ba32483c5627a2860295a266e484d5160) Thanks [@afonja14755](https://github.com/afonja14755)! - fix: encode `username` in URL

## 0.13.3

### Patch Changes

- [#216](https://github.com/un-ts/changesets-gitlab/pull/216) [`0bdd8e8`](https://github.com/un-ts/changesets-gitlab/commit/0bdd8e86af15553dcb64343d9a54f01c5e5e3513) Thanks [@JounQin](https://github.com/JounQin)! - fix: add `newChangesetTemplateFallback` for newer GitLab versions - close [#178](https://github.com/un-ts/changesets-gitlab/issues/178)

  related <https://gitlab.com/gitlab-org/gitlab/-/issues/532221>

## 0.13.2

### Patch Changes

- [#214](https://github.com/un-ts/changesets-gitlab/pull/214) [`b69af62`](https://github.com/un-ts/changesets-gitlab/commit/b69af627480e11ed0d8b11fcdcac122566e6f3e0) Thanks [@JounQin](https://github.com/JounQin)! - fix: detect `git_push_create_all_pipelines` feature flag correctly

- [#214](https://github.com/un-ts/changesets-gitlab/pull/214) [`b69af62`](https://github.com/un-ts/changesets-gitlab/commit/b69af627480e11ed0d8b11fcdcac122566e6f3e0) Thanks [@JounQin](https://github.com/JounQin)! - fix: legacy `types` should point to `.d.cts` instead

## 0.13.1

### Patch Changes

- [#212](https://github.com/un-ts/changesets-gitlab/pull/212) [`7d1eb71`](https://github.com/un-ts/changesets-gitlab/commit/7d1eb7118bc8634812d36dd8b9f180a570d73e48) Thanks [@JounQin](https://github.com/JounQin)! - fix: `p-limit` should be dep instead

## 0.13.0

### Minor Changes

- [`e9adb24`](https://github.com/un-ts/changesets-gitlab/commit/e9adb245cc1152a2bc1516d4259b08f437879308) Thanks [@JounQin](https://github.com/JounQin)! - chore: housekeeping, bump all (dev) deps, add `module-sync` entry

  fix: `commonjs` types entry

- [#195](https://github.com/un-ts/changesets-gitlab/pull/195) [`e7cbdff`](https://github.com/un-ts/changesets-gitlab/commit/e7cbdff3854d7640884735179ab4cb695e62f3c2) Thanks [@WeslleyNasRocha](https://github.com/WeslleyNasRocha)! - feat: fetch the tags and push each one individually based on size of `packages` to be published and `api.FeatureFlags(projectId, 'git_push_create_all_pipelines')`

- [#210](https://github.com/un-ts/changesets-gitlab/pull/210) [`8bdaf2d`](https://github.com/un-ts/changesets-gitlab/commit/8bdaf2de0e249cbf34be9a4e7d199b13e85d242c) Thanks [@JounQin](https://github.com/JounQin)! - feat: try `allDiffs` api first and fallback to `showChanges` when unavailable

- [#209](https://github.com/un-ts/changesets-gitlab/pull/209) [`4ca179c`](https://github.com/un-ts/changesets-gitlab/commit/4ca179c9b7fb0440a8194f97ad65d1294d19810b) Thanks [@JounQin](https://github.com/JounQin)! - feat: add a new optional `GITLAB_COMMENT_CUSTOM_LINKS` environment variable to override the links content referenced in the cli bot comment, use `{{ addChangesetUrl }}` placeholder for the dynamic URL to add a changeset

- [#196](https://github.com/un-ts/changesets-gitlab/pull/196) [`b681513`](https://github.com/un-ts/changesets-gitlab/commit/b6815131caf733494a6f0e243ed64ad9441fc2b4) Thanks [@crysadrak](https://github.com/crysadrak)! - feat: add a new optional `GITLAB_COMMENT_DISCUSSION_AUTO_RESOLVE` environment variable to automatically resolve added discussion when changeset is present, if you want to always resolve the discussion, you should actually use `GITLAB_COMMENT_TYPE=note` instead, default `true`

- [#206](https://github.com/un-ts/changesets-gitlab/pull/206) [`842110d`](https://github.com/un-ts/changesets-gitlab/commit/842110db46fc90e927851ab00389fce93060ff32) Thanks [@jean-smaug](https://github.com/jean-smaug)! - refactor: publish releases with limited concurrency with [`p-limit`](https://github.com/sindresorhus/p-limit)

### Patch Changes

- [#211](https://github.com/un-ts/changesets-gitlab/pull/211) [`6e8e7be`](https://github.com/un-ts/changesets-gitlab/commit/6e8e7be192ba43985518d1695e90686b6d3b297e) Thanks [@JounQin](https://github.com/JounQin)! - chore: add `package.json` entry

## 0.12.2

### Patch Changes

- [#184](https://github.com/un-ts/changesets-gitlab/pull/184) [`006a7e7`](https://github.com/un-ts/changesets-gitlab/commit/006a7e7404a8f77789d15be6b8a5309adfa7ee60) Thanks [@dylf](https://github.com/dylf)! - fix: remove job token

- [#202](https://github.com/un-ts/changesets-gitlab/pull/202) [`bd3280a`](https://github.com/un-ts/changesets-gitlab/commit/bd3280abe32b3a6314ac30ae90f1793def87b34d) Thanks [@TheHolyWaffle](https://github.com/TheHolyWaffle)! - chore: remove unused @sentry/node dependency

## 0.12.1

### Patch Changes

- [#192](https://github.com/un-ts/changesets-gitlab/pull/192) [`a557b95`](https://github.com/un-ts/changesets-gitlab/commit/a557b95d0911d715340ad5ccf1eaaa00ee6a8c49) Thanks [@Tchoupinax](https://github.com/Tchoupinax)! - feat: update labels on update merge request

## 0.12.0

### Minor Changes

- [#180](https://github.com/un-ts/changesets-gitlab/pull/180) [`3678f85`](https://github.com/un-ts/changesets-gitlab/commit/3678f855cd4a2d145581afe5b1ae54b3e8158de1) Thanks [@TheHolyWaffle](https://github.com/TheHolyWaffle)! - Allow adding custom labels to the version package Gitlab Merge Request

## 0.11.5

### Patch Changes

- [#156](https://github.com/un-ts/changesets-gitlab/pull/156) [`3826317`](https://github.com/un-ts/changesets-gitlab/commit/3826317108fc57b0984fca6630e12e56c853d3e6) Thanks [@JounQin](https://github.com/JounQin)! - fix: use discussion or note API accordingly

- [#156](https://github.com/un-ts/changesets-gitlab/pull/156) [`3826317`](https://github.com/un-ts/changesets-gitlab/commit/3826317108fc57b0984fca6630e12e56c853d3e6) Thanks [@JounQin](https://github.com/JounQin)! - fix: comment username could be random - close #145

- [#158](https://github.com/un-ts/changesets-gitlab/pull/158) [`4e02d62`](https://github.com/un-ts/changesets-gitlab/commit/4e02d62dc47182f34318370642d6c202e6ce6700) Thanks [@JounQin](https://github.com/JounQin)! - refactor: handle GitLab API error cause details for tracing

## 0.11.4

### Patch Changes

- [#153](https://github.com/un-ts/changesets-gitlab/pull/153) [`b687dd8`](https://github.com/un-ts/changesets-gitlab/commit/b687dd8b2994aae5de36a127c542c7c85e1dde6b) Thanks [@alan910127](https://github.com/alan910127)! - fix: keeps commenting on every push ~
  - close #145, revert #143

## 0.11.3

### Patch Changes

- [#151](https://github.com/un-ts/changesets-gitlab/pull/151) [`47fa2da`](https://github.com/un-ts/changesets-gitlab/commit/47fa2dacef5284f4448002a74d9ab54368dd4a96) Thanks [@JounQin](https://github.com/JounQin)! - feat: add custom `commit_message` support for adding changeset on Web UI

## 0.11.2

### Patch Changes

- [#147](https://github.com/un-ts/changesets-gitlab/pull/147) [`f8103a8`](https://github.com/un-ts/changesets-gitlab/commit/f8103a8d02215f1aadb42b7c7bd0cb173ac348f2) Thanks [@vinnymac](https://github.com/vinnymac)! - fix: gitlab host fallback environment variables

## 0.11.1

### Patch Changes

- [#143](https://github.com/un-ts/changesets-gitlab/pull/143) [`40818dd`](https://github.com/un-ts/changesets-gitlab/commit/40818dddbe6794ca5a76d9373544c7710a300995) Thanks [@alan910127](https://github.com/alan910127)! - fix: deprecation warning in the `comment` command

## 0.11.0

### Minor Changes

- [#138](https://github.com/un-ts/changesets-gitlab/pull/138) [`be50e4a`](https://github.com/un-ts/changesets-gitlab/commit/be50e4a6ffa42becbb9a5ffab82b931b657d7451) Thanks [@alan910127](https://github.com/alan910127)! - Fix deprecation warning of using @gitbeaker/node package

- [#139](https://github.com/un-ts/changesets-gitlab/pull/139) [`0fcdf63`](https://github.com/un-ts/changesets-gitlab/commit/0fcdf63600c00b0ab976647ad8a2c0cafd8ef632) Thanks [@JounQin](https://github.com/JounQin)! - feat!: bump all (dev)Deps, require node 18+

### Patch Changes

- [#137](https://github.com/un-ts/changesets-gitlab/pull/137) [`955c958`](https://github.com/un-ts/changesets-gitlab/commit/955c95838f634bdb38c359df868cd62a42312b55) Thanks [@angleshe](https://github.com/angleshe)! - fix: not open add changeset url on specific environment

## 0.10.3

### Patch Changes

- [#120](https://github.com/un-ts/changesets-gitlab/pull/120) [`f35cd64`](https://github.com/un-ts/changesets-gitlab/commit/f35cd64b980c3bdf42b8ad83f6c6f037cd892720) Thanks [@coreymcg](https://github.com/coreymcg)! - Fix issue when the release MRs could not be created when gitlab is not hosted at the root of the of the domain (https://www.company.com/gitlab).

## 0.10.2

### Patch Changes

- [#118](https://github.com/un-ts/changesets-gitlab/pull/118) [`5accb23`](https://github.com/un-ts/changesets-gitlab/commit/5accb230aa98f24fc21c6ca094e3ddc9cf1b7df1) Thanks [@zwaittt](https://github.com/zwaittt)! - expose published outputs as env variables to be accessed dicrectly in `PUBLISHED` command process

## 0.10.1

### Patch Changes

- [#113](https://github.com/un-ts/changesets-gitlab/pull/113) [`f8ae011`](https://github.com/un-ts/changesets-gitlab/commit/f8ae011eff359ab9f4b4ac2fa16a86c71cc6357a) Thanks [@Wxh16144](https://github.com/Wxh16144)! - feat: fallback `GITLAB_HOST` to `CI_SERVER_URL` environment

## 0.10.0

### Minor Changes

- [#105](https://github.com/un-ts/changesets-gitlab/pull/105) [`6edb926`](https://github.com/un-ts/changesets-gitlab/commit/6edb926ba92bda053bc3fde1c0d7729b5383049b) Thanks [@JounQin](https://github.com/JounQin)! - feat: ignore private or ignored packages for comment

## 0.9.1

### Patch Changes

- [#100](https://github.com/un-ts/changesets-gitlab/pull/100) [`4498c2f`](https://github.com/un-ts/changesets-gitlab/commit/4498c2fc88f69142a78a3711c29753797f047d67) Thanks [@QuiiBz](https://github.com/QuiiBz)! - fix: editing comment when GITLAB_COMMENT_TYPE is note

## 0.9.0

### Minor Changes

- [#98](https://github.com/un-ts/changesets-gitlab/pull/98) [`d7126ba`](https://github.com/un-ts/changesets-gitlab/commit/d7126bae6e95039a06d6fd3ddfb416011a3721de) Thanks [@QuiiBz](https://github.com/QuiiBz)! - feat: add new `GITLAB_COMMENT_TYPE` environment variable to use discussions or notes

## 0.8.2

### Patch Changes

- [#95](https://github.com/un-ts/changesets-gitlab/pull/95) [`cec113b`](https://github.com/un-ts/changesets-gitlab/commit/cec113bab71dedec03bbfb92a7bf754ea509eb45) Thanks [@AdrielLimanthie](https://github.com/AdrielLimanthie)! - fix: git setup user name should use GITLAB_CI_USER_NAME

## 0.8.1

### Patch Changes

- [#89](https://github.com/un-ts/changesets-gitlab/pull/89) [`12b715f`](https://github.com/un-ts/changesets-gitlab/commit/12b715fed39f1b87b6eea72a11d23ef74b43ea69) Thanks [@godiagonal](https://github.com/godiagonal)! - fix: repair default value for `create_gitlab_releases` variable

## 0.8.0

### Minor Changes

- [#85](https://github.com/un-ts/changesets-gitlab/pull/85) [`65ecc27`](https://github.com/un-ts/changesets-gitlab/commit/65ecc272205462707e9ed80427ee18b7d15b4a3e) Thanks [@wingnorepeat](https://github.com/wingnorepeat)! - feat: added new input variable to indicate whether to create Gitlab releases after publish or not

## 0.7.0

### Minor Changes

- [#71](https://github.com/un-ts/changesets-gitlab/pull/71) [`19466b9`](https://github.com/un-ts/changesets-gitlab/commit/19466b9ed65e9e86e140192a66596d0394be2c88) Thanks [@lluiscab](https://github.com/lluiscab)! - feat: added new input variable controling if the source branch should be automatically deleted or not

## 0.6.0

### Minor Changes

- [#70](https://github.com/un-ts/changesets-gitlab/pull/70) [`2d8b1e0`](https://github.com/un-ts/changesets-gitlab/commit/2d8b1e0d46986680c068ff71cbcb00c29ae2dfdb) Thanks [@lluiscab](https://github.com/lluiscab)! - feat: merge requests target branch can now be configured through a input environment variable

- [#76](https://github.com/un-ts/changesets-gitlab/pull/76) [`f819185`](https://github.com/un-ts/changesets-gitlab/commit/f819185d8cf3392950ab0eb23e201217490ca38a) Thanks [@devtribe](https://github.com/devtribe)! - get username from api instead usage of env variable

## 0.5.6

### Patch Changes

- [#66](https://github.com/un-ts/changesets-gitlab/pull/66) [`1edd410`](https://github.com/un-ts/changesets-gitlab/commit/1edd4105f00780a014060827db972447e9f2fdb7) Thanks [@awxalbert](https://github.com/awxalbert)! - remove --global flag when setting user

## 0.5.5

### Patch Changes

- [#56](https://github.com/un-ts/changesets-gitlab/pull/56) [`27b9985`](https://github.com/un-ts/changesets-gitlab/commit/27b9985b1c9efcff387a51d0a67f50b73fa2399d) Thanks [@JounQin](https://github.com/JounQin)! - chore: update repository links

## 0.5.4

### Patch Changes

- [`7fb2d56`](https://github.com/un-ts/changesets-gitlab/commit/7fb2d56cfbf0e81b7f8f3af0e1a0fc8555e3d216) Thanks [@JounQin](https://github.com/JounQin)! - chore: add donate and funding fields

## 0.5.3

### Patch Changes

- [`00ec9e2`](https://github.com/rx-ts/changesets-gitlab/commit/00ec9e2325ffebc267991f0deed9b9628029616d) Thanks [@JounQin](https://github.com/JounQin)! - fix: check isCreatingBranch logic

## 0.5.2

### Patch Changes

- [#42](https://github.com/rx-ts/changesets-gitlab/pull/42) [`a6f751a`](https://github.com/rx-ts/changesets-gitlab/commit/a6f751a76725c317625555fef315e1380d9a81f6) Thanks [@pmjhonwang](https://github.com/pmjhonwang)! - some system git version old, `git add -a .` not working at dot prefix dir (such as .changeset), use `git add -A .` instead

## 0.5.1

### Patch Changes

- [#34](https://github.com/rx-ts/changesets-gitlab/pull/34) [`4eb189c`](https://github.com/rx-ts/changesets-gitlab/commit/4eb189c370dec72cb4ce1babe1b89e2d32420436) Thanks [@pmjhonwang](https://github.com/pmjhonwang)! - slience @action/exec to execute settting GitLab credentials

## 0.5.0

### Minor Changes

- [#27](https://github.com/rx-ts/changesets-gitlab/pull/27) [`7538fa1`](https://github.com/rx-ts/changesets-gitlab/commit/7538fa10a241f3d979c16f481164694e3d57473b) Thanks [@JounQin](https://github.com/JounQin)! - feat: create comment with discussion instead of note

## 0.4.0

### Minor Changes

- [#23](https://github.com/rx-ts/changesets-gitlab/pull/23) [`9e6cb95`](https://github.com/rx-ts/changesets-gitlab/commit/9e6cb95f22532eb18df7f95747140ffef5e4c80a) Thanks [@HosseinAgha](https://github.com/HosseinAgha)! - Add support for job tokens and oauth tokens (via GITLAB_TOKEN_TYPE config), The Gitlab job tokens have limited access only to Gitlab package registry so we cannot use it until [this Epic](https://gitlab.com/groups/gitlab-org/-/epics/3559) gets implemented.

### Patch Changes

- [#23](https://github.com/rx-ts/changesets-gitlab/pull/23) [`9e6cb95`](https://github.com/rx-ts/changesets-gitlab/commit/9e6cb95f22532eb18df7f95747140ffef5e4c80a) Thanks [@HosseinAgha](https://github.com/HosseinAgha)! - Add missing dependencies to the package.json

- [`1b3ec8e`](https://github.com/rx-ts/changesets-gitlab/commit/1b3ec8eafaa9fb58ac444e1c873d2cb832f24e76) Thanks [@JounQin](https://github.com/JounQin)! - feat: add main and module entries for compatibility

## 0.3.0

### Minor Changes

- [#7](https://github.com/rx-ts/changesets-gitlab/pull/7) [`74f1c72`](https://github.com/rx-ts/changesets-gitlab/commit/74f1c72a2a7aa7861de7d85503a005bf22557e09) Thanks [@JounQin](https://github.com/JounQin)! - feat: support command on published/only-changesets

## 0.2.0

### Minor Changes

- [#5](https://github.com/rx-ts/changesets-gitlab/pull/5) [`1308462`](https://github.com/rx-ts/changesets-gitlab/commit/130846299026cd685e1e0f0fdbbadb7dca5572cb) Thanks [@JounQin](https://github.com/JounQin)! - feat: support comment on MR automatically

## 0.1.2

### Patch Changes

- [`44d561d`](https://github.com/rx-ts/changesets-gitlab/commit/44d561d48efbeaca14c1625da9c2db94badfe9d9) Thanks [@JounQin](https://github.com/JounQin)! - fix: gitlab authentication with username and token

## 0.1.1

### Patch Changes

- [`7f81cff`](https://github.com/rx-ts/changesets-gitlab/commit/7f81cff568243d4314d5869a77d812d77d1cb5ae) Thanks [@JounQin](https://github.com/JounQin)! - fix: incorrect bin file location

## 0.1.0

### Minor Changes

- [#1](https://github.com/rx-ts/changesets-gitlab/pull/1) [`9091cd6`](https://github.com/rx-ts/changesets-gitlab/commit/9091cd635f155055d521ba4bd083e047464e4e88) Thanks [@JounQin](https://github.com/JounQin)! - feat: first blood, should just work
