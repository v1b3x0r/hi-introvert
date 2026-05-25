/**
 * Agent smoke test — minimal Ink rendering check.
 *
 * Full keystroke-driven tests turn out to be brittle: ink-testing-library
 * + UTF-8 Thai input + Enter key handling don't compose cleanly across
 * Bun versions. Manual smoke runs (see `node dist/index.js` output) verify
 * the deeper flows: Thai chat → companion replies, vocab growth, /help,
 * /privacy, /status. This file just confirms the component tree mounts
 * without crashing — the regression we care most about.
 */

import { test, expect, beforeAll } from 'bun:test'
import { unlinkSync, existsSync } from 'fs'
import React from 'react'

const SESSION_FILE = '.hi-introvert-session.json'

beforeAll(() => {
  console.log = () => {}
  console.info = () => {}
  console.warn = () => {}
  if (existsSync(SESSION_FILE)) {
    try { unlinkSync(SESSION_FILE) } catch {}
  }
})

test('App mounts and renders banner + input box without crashing', async () => {
  const { render } = await import('ink-testing-library')
  const { App } = await import('../src/ui/ink/App')

  const ui = render(React.createElement(App))
  await new Promise(r => setTimeout(r, 150))

  const frame = ui.lastFrame() ?? ''
  expect(frame).toContain('Tips')
  expect(frame).toContain('vocab')
  expect(frame).toContain('>')  // input prompt
  expect(frame).toMatch(/v1\.2\.\d+/)  // footer version
  // Regression for "Objects are not valid as a React child"
  expect(frame).not.toMatch(/\{"name":/)
  expect(frame).not.toMatch(/"response":/)

  ui.unmount()
}, 5000)
