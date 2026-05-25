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

  test('after teaching a name, memory token is appended to vocabulary pool', async () => {
    const { WorldSession } = await import('../src/session/WorldSession')
    const session = new WorldSession()
    session.setSilentMode(true)

    // Establish vocab + name memory
    await session.handleUserMessage('สวัสดีครับ')
    await session.handleUserMessage('ผมชื่อบ้าน')  // dict-word so it tokenizes cleanly

    // Collect proto-lang events to inspect the vocabulary pool
    const protoLangEvents: any[] = []
    session.on('proto-lang', (ev: any) => protoLangEvents.push(ev))

    // Trigger a memory-guided question so the proto-lang path runs
    let nullReplies = 0
    let errors = 0
    const sampleReplies: any[] = []
    for (let i = 0; i < 10; i++) {
      try {
        const r = await session.handleUserMessage('ชื่อผมคืออะไร')
        if (i < 5) sampleReplies.push(r?.response ?? '(null)')
        if (!r?.response) nullReplies++
      } catch (e) {
        errors++
        if (i === 0) sampleReplies.push('ERROR: ' + (e instanceof Error ? e.message : String(e)))
      }
    }

    process.stderr.write(`[name] null=${nullReplies} err=${errors}\n`)
    process.stderr.write(`[samples] ${JSON.stringify(sampleReplies)}\n`)
    process.stderr.write(`[proto-lang events] ${protoLangEvents.length}\n`)

    // Assert session produces responses (not crashes/nulls)
    expect(nullReplies).toBe(0)
    // At least one proto-lang event should have fired (memory-guided question path)
    expect(protoLangEvents.length).toBeGreaterThan(0)
    // mds-core 5.11 samples the full pool — vocabulary pool grows with memory tokens
    const poolSize = protoLangEvents[0]?.vocabularySize ?? 0
    process.stderr.write(`[pool size] ${poolSize}\n`)
    expect(poolSize).toBeGreaterThan(0)
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
