#!/usr/bin/env node
/**
 * README swap helper for npm publish.
 *
 * npm registry serves whatever is in README.md inside the tarball, so to
 * publish a different README on npm than on GitHub we:
 *
 *   prepack  — back up the current README.md to an OS temp file, then copy
 *              docs/readme-npm.md over README.md so the tarball carries the
 *              vibe-deck text under the canonical name npm expects.
 *
 *   postpack — copy the temp backup back to README.md.
 *
 * The backup lives in os.tmpdir() (NOT the package root) so it never
 * leaks into the npm tarball — npm auto-includes any README* / LICENSE*
 * file from the package root regardless of `files` or `.npmignore`.
 *
 * The temp path is derived deterministically from the project root +
 * package name, so prepack and postpack agree without env vars.
 *
 * Usage:
 *   node scripts/swap-readme.mjs to-npm
 *   node scripts/swap-readme.mjs restore
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { resolve, basename } from 'path'
import { tmpdir } from 'os'
import { createHash } from 'crypto'

const root = process.cwd()
const README = resolve(root, 'README.md')
const README_NPM = resolve(root, 'docs/readme-npm.md')

const backupKey = createHash('sha1').update(root).digest('hex').slice(0, 12)
const README_BACKUP = resolve(tmpdir(), `hi-introvert-readme-backup-${backupKey}.md`)

const mode = process.argv[2]

function read(path) { return readFileSync(path, 'utf-8') }
function write(path, content) { writeFileSync(path, content, 'utf-8') }

if (mode === 'to-npm') {
  if (!existsSync(README_NPM)) {
    console.error('[swap-readme] docs/readme-npm.md missing — nothing to swap in.')
    process.exit(1)
  }
  if (existsSync(README_BACKUP)) {
    console.error(`[swap-readme] backup already exists at ${README_BACKUP} — previous swap did not restore. Restore manually:`)
    console.error(`  cp '${README_BACKUP}' README.md && rm '${README_BACKUP}'`)
    process.exit(1)
  }
  if (existsSync(README)) {
    write(README_BACKUP, read(README))
  }
  write(README, read(README_NPM))
  console.log(`[swap-readme] README.md ← docs/readme-npm.md  (dev version backed up to ${basename(README_BACKUP)} in tmpdir)`)
}
else if (mode === 'restore') {
  if (!existsSync(README_BACKUP)) {
    console.log('[swap-readme] no backup found — nothing to restore.')
    process.exit(0)
  }
  write(README, read(README_BACKUP))
  unlinkSync(README_BACKUP)
  console.log('[swap-readme] README.md restored from tmpdir backup  (backup deleted)')
}
else {
  console.error('Usage: swap-readme.mjs <to-npm|restore>')
  process.exit(1)
}
