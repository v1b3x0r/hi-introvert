/**
 * End-to-end: companion must answer with the user's name after introduction.
 *
 * Drives a real WorldSession (no UI) through introduction → many question
 * turns, then asserts on two layers:
 *
 *   1. WRITE side — an identity memory is stored with `subject: 'user_name'`
 *      and `content.name` equal to the captured name.
 *   2. READ + POOL side — over N attempts at the same name question, the
 *      companion's emergent reply surfaces the name at least once. We allow
 *      stochasticity (proto-lang samples a pool) but with the layered fix the
 *      name token is biased heavily enough that ≥1 hit in 30 attempts is
 *      strongly expected.
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

describe('name recall (end-to-end)', () => {
  test('introduction stores an identity memory tagged subject=user_name', async () => {
    const { WorldSession } = await import('../../src/session/WorldSession')
    const session = new WorldSession()
    session.setSilentMode(true)

    await session.handleUserMessage('ผมชื่อ Wutty')

    const companion = session.companionEntity.entity
    const identityMems = (companion.memory?.recall?.({ subject: 'user_name' }) ?? []) as any[]

    expect(identityMems.length).toBeGreaterThan(0)
    expect(identityMems[0].content?.name).toBe('Wutty')

    // Keywords field populated so mds-core recallByTopic works.
    expect(Array.isArray(identityMems[0].keywords)).toBe(true)
    expect(identityMems[0].keywords).toContain('name')
    expect(identityMems[0].keywords).toContain('ชื่อ')
  })

  test('name surfaces at production-scale vocab (≥3 hits in 10 attempts)', async () => {
    // The earlier tests pass because their vocab pool is artificially tiny.
    // In live use the vocab grows to 500+ words and a 30× boost dilutes to
    // ~4% per slot. This test mirrors the production scale and asserts the
    // bias is strong enough to surface reliably in a short question loop.
    const { WorldSession } = await import('../../src/session/WorldSession')
    const session = new WorldSession()
    session.setSilentMode(true)

    // Pump vocabulary up to a realistic size (~400+ words) before the
    // introduction. The vocabularyTracker normally absorbs words from user
    // turns; we inject directly via its known-word set to skip the slow path.
    const filler: string[] = []
    for (let i = 0; i < 400; i++) filler.push(`filler${i}`)
    // Drive a single message so the tracker is in normal state; then seed.
    await session.handleUserMessage('hi')
    ;(session.vocabularyTracker as any).knownWords = new Set([
      ...(session.vocabularyTracker as any).knownWords,
      ...filler,
    ])

    await session.handleUserMessage('call me Wutty')

    let hits = 0
    const samples: string[] = []
    for (let i = 0; i < 10; i++) {
      const reply = await session.handleUserMessage('do you remember me?')
      const text = (reply?.response ?? '').toLowerCase()
      samples.push(reply?.response ?? '(null)')
      if (text.includes('wutty')) hits++
    }

    process.stderr.write(`[prod-scale name-recall] hits=${hits}/10\n`)
    if (hits < 3) {
      process.stderr.write('[samples]\n')
      for (const r of samples) process.stderr.write(`  ${r}\n`)
    }
    expect(hits).toBeGreaterThanOrEqual(3)
  }, 30000)

  test('companion surfaces name on "do you remember me?" (no explicit "name" word)', async () => {
    const { WorldSession } = await import('../../src/session/WorldSession')
    const session = new WorldSession()
    session.setSilentMode(true)

    // Build vocab + introduce via the phrasing user actually typed.
    for (const m of [
      'hi there',
      'how are you today',
      'i like talking',
      'tell me something',
    ]) {
      await session.handleUserMessage(m)
    }
    await session.handleUserMessage('call me Wutty')

    // Question that contains NO "name/ชื่อ" word — only "remember".
    let surfaced = false
    const samples: string[] = []
    for (let i = 0; i < 30; i++) {
      const reply = await session.handleUserMessage('do you remember me?')
      const text = (reply?.response ?? '').toLowerCase()
      samples.push(reply?.response ?? '(null)')
      if (text.includes('wutty')) {
        surfaced = true
        break
      }
    }
    if (!surfaced) {
      process.stderr.write('[remember-me samples]\n')
      for (const r of samples.slice(0, 10)) process.stderr.write(`  ${r}\n`)
    }
    expect(surfaced).toBe(true)
  }, 30000)

  test('companion surfaces the user\'s name when asked (≥1 hit in 30 attempts)', async () => {
    const { WorldSession } = await import('../../src/session/WorldSession')
    const session = new WorldSession()
    session.setSilentMode(true)

    // Build vocabulary first so proto-lang path activates (≥20 words).
    // The post-introduction question path needs the proto-lang branch.
    for (const m of [
      'สวัสดี companion',
      'how are you today',
      'ผมรู้สึกดี',
      'อากาศวันนี้สดใส',
      'i like talking with you',
      'tell me something interesting',
      'ผมชอบเขียน code',
      'sometimes i feel quiet',
    ]) {
      await session.handleUserMessage(m)
    }

    // Introduce name.
    await session.handleUserMessage('ผมชื่อ Wutty')

    // Drive the question — proto-lang sampling has randomness, so loop.
    const replies: string[] = []
    let surfaced = false
    for (let i = 0; i < 30; i++) {
      const reply = await session.handleUserMessage('ชื่อผมคืออะไร')
      const text = (reply?.response ?? '').toLowerCase()
      replies.push(reply?.response ?? '(null)')
      if (text.includes('wutty')) {
        surfaced = true
        break
      }
    }

    if (!surfaced) {
      process.stderr.write('[name-recall samples]\n')
      for (const r of replies.slice(0, 10)) process.stderr.write(`  ${r}\n`)
    }
    expect(surfaced).toBe(true)
  }, 30000)
})
