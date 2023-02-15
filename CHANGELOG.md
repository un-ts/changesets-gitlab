# changesets-gitlab

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
