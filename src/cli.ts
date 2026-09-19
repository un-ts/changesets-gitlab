#!/usr/bin/env node

import './env.js'

import * as core from '@actions/core'
import { program } from 'commander'

import { comment } from './comment.js'
import { main } from './main.js'
import { pack } from './pack.js'
import { prComment } from './pr-comment.js'
import { prStatus } from './pr-status.js'
import { publish } from './publish.js'
import { selectMode } from './select-mode.js'
import { require, getOptionalInput } from './utils.js'
import { version } from './version.js'

const run = async () => {
  program.version((require('../package.json') as { version: string }).version)

  program.command('comment').action(async () => {
    await comment()
  })

  program
    .command('pr-status')
    .description('Generate the changesets status message for the merge request')
    .action(prStatus)

  program
    .command('pr-comment')
    .description('Create or update a comment on the merge request')
    .action(prComment)

  program
    .command('select-mode')
    .description(
      'Decide whether to version or publish in the current repository state',
    )
    .action(selectMode)

  program
    .command('version')
    .description(
      'Version packages and open or update the release merge request',
    )
    .action(version)

  program
    .command('pack')
    .description('Pack publishable packages into tarballs')
    .option(
      '--publish-plan <path>',
      'Path to a publish plan from `select-mode`',
    )
    .option('--out-dir <dir>', 'Directory to write the packed tarballs to')
    .action(pack)

  program
    .command('publish')
    .description('Publish packages to npm and create GitLab releases')
    .option('--from-pack-dir <dir>', 'Directory with packed output from `pack`')
    .action(publish)

  program.command('main', { isDefault: true }).action(() =>
    main({
      published: getOptionalInput('published'),
      onlyChangesets: getOptionalInput('only-changesets'),
    }),
  )

  return program.showHelpAfterError().parseAsync()
}

// eslint-disable-next-line unicorn-x/prefer-top-level-await
run().catch((err: Error) => {
  core.setFailed(err.message)
})
