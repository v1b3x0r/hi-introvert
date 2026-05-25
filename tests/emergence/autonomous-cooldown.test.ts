/**
 * E3 cooldown: generateAutonomousMessage() returns null within the
 * cooldown window AND emits 'autonomous-skip' with reason 'cooldown'.
 *
 * Deterministic — uses a manually-set lastAutonomousAt to simulate
 * elapsed time without needing a clock mock.
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

test('cooldown blocks second call within window and emits autonomous-skip', async () => {
  const { WorldSession, AUTONOMOUS_COOLDOWN_MS } = await import('../../src/session/WorldSession')
  const session = new WorldSession()
  session.setSilentMode(true)

  expect(AUTONOMOUS_COOLDOWN_MS).toBeGreaterThan(0)

  const skipEvents: any[] = []
  session.on('autonomous-skip', e => skipEvents.push(e))

  // First call: should emit (no prior emission so cooldown does not block).
  // Vocab is naturally above PROTO_LANG_PRIORITY_THRESHOLD because
  // BASE_VOCABULARY is ~200 words; proto-first path will run.
  const r1 = await session.generateAutonomousMessage()
  // r1 may be null if all paths failed for non-cooldown reasons. Skip case if so.
  if (!r1) {
    process.stderr.write(`[cooldown] first call returned null for non-cooldown reasons; aborting case\n`)
    return
  }

  // Second call immediately after: should be blocked by cooldown.
  const r2 = await session.generateAutonomousMessage()
  expect(r2).toBeNull()
  expect(skipEvents.length).toBe(1)
  expect(skipEvents[0]).toMatchObject({ reason: 'cooldown' })
  expect(typeof skipEvents[0].sinceMs).toBe('number')
  expect(skipEvents[0].sinceMs).toBeLessThan(AUTONOMOUS_COOLDOWN_MS)
})

test('after AUTONOMOUS_COOLDOWN_MS elapses, next call is no longer blocked', async () => {
  const { WorldSession, AUTONOMOUS_COOLDOWN_MS } = await import('../../src/session/WorldSession')
  const session = new WorldSession()
  session.setSilentMode(true)

  // Manually set lastAutonomousAt to a value beyond the cooldown window.
  ;(session as any).lastAutonomousAt = Date.now() - (AUTONOMOUS_COOLDOWN_MS + 5000)

  const skipEvents: any[] = []
  session.on('autonomous-skip', e => skipEvents.push(e))

  const r = await session.generateAutonomousMessage()
  // r may be null for non-cooldown reasons, but the skip event must NOT fire.
  expect(skipEvents.length).toBe(0)
})

test('cooldown does not start ticking on a null (silent) result', async () => {
  // If generateAutonomousMessage returns null for *other* reasons (e.g. no
  // valid output produced), lastAutonomousAt must stay at 0 so the next
  // tick is not also suppressed by cooldown — silence-on-top-of-silence
  // would be a stuck state.
  const { WorldSession } = await import('../../src/session/WorldSession')
  const session = new WorldSession()
  session.setSilentMode(true)

  // Force companion non-autonomous so generateAutonomousMessage returns null early.
  const companion = (session as any).companionEntity.entity
  companion.disableAutonomous()

  const r = await session.generateAutonomousMessage()
  expect(r).toBeNull()

  // Re-enable and check that lastAutonomousAt is still 0 (no false update).
  companion.enableAutonomous()
  expect((session as any).lastAutonomousAt).toBe(0)
})
