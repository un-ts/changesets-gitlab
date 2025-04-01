#!/usr/bin/env node

import './env.js'

import { program } from 'commander'

import { comment } from './comment.js'
import { main } from './main.js'
import { cjsRequire, getOptionalInput } from './utils.js'

const run = async () => {
  program.version(
    (cjsRequire('../package.json') as { version: string }).version,
  )

  program.command('comment').action(async () => {
    await comment()
  })

  program.command('main', { isDefault: true }).action(() =>
    main({
      published: getOptionalInput('published'),
      onlyChangesets: getOptionalInput('only_changesets'),
    }),
  )

  return program.showHelpAfterError().parseAsync()
}

// eslint-disable-next-line unicorn/prefer-top-level-await
run().catch((err: Error) => {
  console.error(err)
  process.exitCode = 1
})
