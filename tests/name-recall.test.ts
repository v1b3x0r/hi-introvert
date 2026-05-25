/**
 * Behavioral test: does the companion remember and use the user's name?
 *
 * Boots a real WorldSession (no UI) and drives a short conversation,
 * then asserts on the conversation log + entity.memory.recall to figure
 * out which layer the "name awareness" breaks at.
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

describe('name recall', () => {
  test('what the companion stores when user introduces themselves', async () => {
    const { WorldSession } = await import('../src/session/WorldSession')
    const session = new WorldSession()
    session.setSilentMode(true)

    // Phase 1a: Tell companion the name
    const intro = await session.handleUserMessage('ผมชื่อ วุตตี้')
    console.error('[introduction reply]', intro?.response)

    // Phase 1b: Inspect what got stored in companion's memory
    const companion = session.companionEntity.entity
    const memories = companion.memory?.recall?.() ?? []
    console.error('[memory count]', memories.length)
    console.error('[memory subjects]', memories.map((m: any) => m.subject))
    console.error('[memories about traveler]', memories.filter((m: any) => m.subject === 'traveler'))
    console.error('[memories with name]',
      memories.filter((m: any) => JSON.stringify(m.content || '').includes('วุตตี้'))
    )

    // Phase 1c: Ask the name back
    const askBack = await session.handleUserMessage('ผมชื่ออะไร')
    console.error('[asked back reply]', askBack?.response)

    const remembers = await session.handleUserMessage('จำชื่อผมได้ไหม')
    console.error('[remembers reply]', remembers?.response)

    // This is exploratory — not asserting yet, just gathering evidence
    expect(intro).toBeTruthy()
  })

  test('after teaching a name, repeated asking surfaces it eventually (boosted memory)', async () => {
    const { WorldSession } = await import('../src/session/WorldSession')
    const session = new WorldSession()
    session.setSilentMode(true)

    // Establish vocab + name memory
    await session.handleUserMessage('สวัสดีครับ')
    await session.handleUserMessage('ผมชื่อบ้าน')  // dict-word so it tokenizes cleanly

    // Ask 5 times first to see what's coming back
    let hits = 0
    let nullReplies = 0
    let errors = 0
    const sampleReplies: any[] = []
    for (let i = 0; i < 30; i++) {
      try {
        const r = await session.handleUserMessage('ชื่อผมคืออะไร')
        if (i < 10) sampleReplies.push(r?.response ?? '(null)')
        if (!r?.response) { nullReplies++; continue }
        if (r.response.includes('บ้าน')) hits++
      } catch (e) {
        errors++
        if (i === 0) sampleReplies.push('ERROR: ' + (e instanceof Error ? e.message : String(e)))
      }
    }

    process.stderr.write(`[name] hits=${hits}/30 null=${nullReplies} err=${errors}\n`)
    process.stderr.write(`[samples] ${JSON.stringify(sampleReplies)}\n`)
    // Without boost, P("บ้าน") in a 1-4 word sample from ~600 pool ≈ 0.5%
    // → expected ~0.15 hits over 30 trials
    // With boost (x8 salience-weighted), expected ~5+ hits.
    // Use a conservative bar to avoid flakiness from anti-repeat + dialogue fallbacks.
    expect(hits).toBeGreaterThan(0)
  }, 15000)

  test('what subjects do existing remember() calls use?', async () => {
    const { WorldSession } = await import('../src/session/WorldSession')
    const session = new WorldSession()
    session.setSilentMode(true)

    // Several different messages
    await session.handleUserMessage('สวัสดีครับ')
    await session.handleUserMessage('ผมชื่อ Wutty')
    await session.handleUserMessage('ผมเป็นโปรแกรมเมอร์')
    await session.handleUserMessage('วันนี้อากาศดี')

    const companion = session.companionEntity.entity
    const memories = companion.memory?.recall?.() ?? []

    // Group memories by subject
    const bySubject = new Map<string, any[]>()
    for (const m of memories) {
      const s = m.subject ?? '<none>'
      if (!bySubject.has(s)) bySubject.set(s, [])
      bySubject.get(s)!.push(m)
    }

    console.error('[subjects]', Array.from(bySubject.entries()).map(
      ([s, ms]) => `${s}: ${ms.length}`
    ))

    // Show full content of first few memories
    for (const m of memories.slice(0, 5)) {
      console.error('  memory:', JSON.stringify({
        subject: m.subject,
        content: m.content,
        salience: m.salience,
      }))
    }

    expect(memories.length).toBeGreaterThan(0)
  })
})
