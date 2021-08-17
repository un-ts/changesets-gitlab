#!/usr/bin/env node

import './env.js'

import _ from 'module'

import { setFailed } from '@actions/core'
import { program } from 'commander'

import { comment } from './comment.js'
import { main } from './main.js'

const cjsRequire =
  typeof require === 'undefined' ? _.createRequire(import.meta.url) : require

const run = () => {
  const { GITLAB_CI_USER_NAME, GITLAB_TOKEN } = process.env

  if (!GITLAB_TOKEN || !GITLAB_CI_USER_NAME) {
    setFailed(
      'Please add the `GITLAB_TOKEN` and `GITLAB_CI_USER_NAME` to the changesets action',
    )
    return
  }

  program.version(
    (cjsRequire('../package.json') as { version: string }).version,
  )

  program.command('comment').action(async () => {
    await comment()
  })

  program
    .command('main', {
      isDefault: true,
    })
    .option('-p, --published <command>', 'Command executed after published')
    .option(
      '-oc, --only-changesets <command>',
      'Command executed on only changesets detected',
    )
    .action(main)

  program.parse()
}

run()
