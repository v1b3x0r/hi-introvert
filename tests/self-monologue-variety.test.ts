/**
 * Regression test for the "ถ้าฉันเรียนรู้นานพอ..." flood.
 *
 * Drives WorldSession.generateAutonomousMessage() repeatedly and asserts
 * the same line doesn't dominate the output, even though mds-core's
 * underlying entity.speak() picks deterministically.
 */

import { test, expect, beforeAll } from 'bun:test'
import { unlinkSync, existsSync } from 'fs'

const SESSION_FILE = '.hi-introvert-session.json'

beforeAll(() => {
  console.log = () => {}
  console.info = () => {}
  console.warn = () => {}
  if (existsSync(SESSION_FILE)) {
    try { unlinkSync(SESSION_FILE) } catch {}
  }
})

test('20 autonomous monologues produce at least 5 unique lines', async () => {
  const { WorldSession } = await import('../src/session/WorldSession')
  const session = new WorldSession()
  session.setSilentMode(true)

  const seen = new Set<string>()
  let nullReplies = 0
  for (let i = 0; i < 20; i++) {
    // Reset E3 cooldown so this variety test isn't gated between iterations.
    ;(session as any).lastAutonomousAt = 0
    const r = await session.generateAutonomousMessage()
    if (!r?.response) { nullReplies++; continue }
    seen.add(r.response)
  }

  process.stderr.write(`[monologue variety] unique=${seen.size}/20, null=${nullReplies}\n`)
  process.stderr.write(`[samples] ${JSON.stringify([...seen].slice(0, 6))}\n`)

  // companion.mdm has 16 self_monologue lines (8 Thai + 8 English).
  // With a history window of 6 we should easily see 5+ unique across 20 calls.
  expect(seen.size).toBeGreaterThanOrEqual(5)
}, 10000)
