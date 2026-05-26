/**
 * E1 integration: companion-specific MDM tokens reach the proto-language
 * pool, so emergent autonomous output can use authored vocabulary
 * (companion voice) alongside user-learned words.
 *
 * The default companion.mdm is now the minimal English seed (~26 lines)
 * with near-zero authored tokens — that's the showcase. These tests
 * therefore verify the *wiring* (extract → cache → pool → output) by
 * deriving expected cache content from whatever MDM is currently loaded,
 * and by injecting synthetic tokens for the integration check.
 */

import { test, expect, beforeAll } from 'bun:test'
import { unlinkSync, existsSync } from 'fs'

const SESSION_FILE = '.hi-introvert-session.json'
const INJECTED_TOKENS = ['quiet-marker-token-a', 'quiet-marker-token-b', 'quiet-marker-token-c']

beforeAll(() => {
  console.log = () => {}
  console.info = () => {}
  console.warn = () => {}
  if (existsSync(SESSION_FILE)) {
    try { unlinkSync(SESSION_FILE) } catch {}
  }
})

test('companionTokens cache reflects extractCompanionTokens(MDM, BASE_VOCABULARY)', async () => {
  const { WorldSession } = await import('../../src/session/WorldSession')
  const { extractCompanionTokens } = await import('../../src/utils/mdm-tokens')
  const { BASE_VOCABULARY } = await import('../../src/vocabulary/base-vocabulary')
  const companionMDM = (await import('../../entities/companion.mdm', { with: { type: 'json' } })).default

  const session = new WorldSession()
  session.setSilentMode(true)

  // The constructor wiring populates `companionTokens` from
  // extractCompanionTokens(companionMDM, BASE_VOCABULARY). Re-derive and
  // compare — this tests the wiring without asserting specific MDM content.
  const expected = extractCompanionTokens(companionMDM, BASE_VOCABULARY)
  const tokens = (session as any).companionTokens as string[]

  expect(Array.isArray(tokens)).toBe(true)
  expect(tokens).toEqual(expected)
  process.stderr.write(`[vocab-seeding] cache size=${tokens.length}\n`)
})

test('group-level: injected companion tokens surface in 100 autonomous outputs', async () => {
  const { WorldSession } = await import('../../src/session/WorldSession')
  const session = new WorldSession()
  session.setSilentMode(true)

  // Inject synthetic tokens to test the cache→pool→output pipeline
  // regardless of which MDM is loaded as default.
  ;(session as any).companionTokens = INJECTED_TOKENS

  // Force vocab size above E2's threshold so proto-lang can engage.
  for (let i = 0; i < 60; i++) {
    ;(session as any).vocabularyTracker.detectNewWords(`testword${i} hello สวัสดี`)
  }

  const all: string[] = []
  for (let i = 0; i < 100; i++) {
    // Reset cooldown so this test isn't gated by E3.
    ;(session as any).lastAutonomousAt = 0
    const r = await session.generateAutonomousMessage()
    if (r?.response) all.push(r.response)
  }

  const combined = all.join(' ')
  const seen = INJECTED_TOKENS.filter(t => combined.includes(t))

  process.stderr.write(`[vocab-seeding] 100 outputs produced ${all.length} non-null replies\n`)
  process.stderr.write(`[vocab-seeding] injected tokens observed: ${JSON.stringify(seen)}\n`)

  expect(seen.length).toBeGreaterThanOrEqual(1)
}, 30000)
