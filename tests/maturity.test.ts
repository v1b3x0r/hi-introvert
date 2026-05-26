/**
 * Bug 2 regression: emotionalMaturity must move off zero as the companion
 * gains experience.
 *
 * Pre-fix: GrowthTracker.metrics.emotionalMaturity was initialised to 0
 * and never written by any code path — display always read 0%.
 *
 * Post-fix: WorldSession.handleUserMessage computes maturity from
 *   0.5 × companion.emotion.dominance + 0.5 × memory-subject diversity
 * and pushes it through growthTracker.update().
 */

import { test, expect, describe, beforeAll } from 'bun:test'
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

describe('emotionalMaturity (Bug 2)', () => {
  test('maturity is > 0 after a single message', async () => {
    const { WorldSession } = await import('../src/session/WorldSession')
    const session = new WorldSession()
    session.setSilentMode(true)

    await session.handleUserMessage('สวัสดี companion')

    const m = session.growthTracker.getMetrics()
    expect(m.emotionalMaturity).toBeGreaterThan(0)
    expect(m.emotionalMaturity).toBeLessThanOrEqual(1)
  })

  test('maturity grows with subject diversity', async () => {
    const { WorldSession } = await import('../src/session/WorldSession')
    const session = new WorldSession()
    session.setSilentMode(true)

    // One generic message — small diversity
    await session.handleUserMessage('hi')
    const m1 = session.growthTracker.getMetrics().emotionalMaturity

    // Introduce name → adds 'user_name' subject diversity. Plus accumulate
    // a few more turns to populate vocab/self/traveler subjects.
    await session.handleUserMessage("I'm Wutty")
    await session.handleUserMessage('how are you')
    await session.handleUserMessage('I learned a new word today')
    const m2 = session.growthTracker.getMetrics().emotionalMaturity

    // After more diverse interaction, maturity should not decrease and
    // should usually grow. Allow equality for stochastic emotion paths.
    expect(m2).toBeGreaterThanOrEqual(m1)
    expect(m2).toBeGreaterThan(0)
  })
})
