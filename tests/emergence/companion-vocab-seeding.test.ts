/**
 * E1 integration: companion-specific MDM tokens reach the proto-language
 * pool, so emergent autonomous output can use words like เงียบ/ลึก/ภายใน
 * (companion voice) instead of only kid-language base vocab.
 *
 * Group-level assertion across 100 autonomous-message attempts:
 * at least one companion-specific token surfaces somewhere in the
 * collected output. Not flaky as long as wiring is correct.
 */

import { test, expect, beforeAll } from 'bun:test'
import { unlinkSync, existsSync } from 'fs'

const SESSION_FILE = '.hi-introvert-session.json'
const COMPANION_TOKENS_OF_INTEREST = ['เงียบ', 'ลึก', 'ภายใน', 'บางที', 'เรียนรู้', 'รู้สึก']

beforeAll(() => {
  console.log = () => {}
  console.info = () => {}
  console.warn = () => {}
  if (existsSync(SESSION_FILE)) {
    try { unlinkSync(SESSION_FILE) } catch {}
  }
})

test('companionTokens cache is non-empty and contains expected words', async () => {
  const { WorldSession } = await import('../../src/session/WorldSession')
  const session = new WorldSession()
  session.setSilentMode(true)

  // Access the cached tokens via type-cheat for assertion purposes
  const tokens = (session as any).companionTokens as string[]
  expect(Array.isArray(tokens)).toBe(true)
  expect(tokens.length).toBeGreaterThan(5)

  const surviving = COMPANION_TOKENS_OF_INTEREST.filter(t => tokens.includes(t))
  process.stderr.write(`[vocab-seeding] cache size=${tokens.length}, surviving=${JSON.stringify(surviving)}\n`)
  expect(surviving.length).toBeGreaterThanOrEqual(1)
})

test('group-level: at least one companion token appears in 100 autonomous outputs', async () => {
  const { WorldSession } = await import('../../src/session/WorldSession')
  const session = new WorldSession()
  session.setSilentMode(true)

  // Force vocab size above E2's threshold so proto-lang can engage.
  for (let i = 0; i < 60; i++) {
    ;(session as any).vocabularyTracker.detectNewWords(`testword${i} hello สวัสดี`)
  }

  const all: string[] = []
  for (let i = 0; i < 100; i++) {
    const r = await session.generateAutonomousMessage()
    if (r?.response) all.push(r.response)
  }

  const combined = all.join(' ')
  const seen = COMPANION_TOKENS_OF_INTEREST.filter(t => combined.includes(t))

  process.stderr.write(`[vocab-seeding] 100 outputs produced ${all.length} non-null replies\n`)
  process.stderr.write(`[vocab-seeding] tokens observed: ${JSON.stringify(seen)}\n`)

  // The unification claim: at least one companion-specific token should
  // surface across 100 outputs. If E1 wiring works, this is comfortable.
  expect(seen.length).toBeGreaterThanOrEqual(1)
}, 30000)
