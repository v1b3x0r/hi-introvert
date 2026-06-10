/**
 * F1 end-to-end: declared skill triggers make companion skills GROW.
 *
 * Loop under test:
 *   companion.mdm skills.learnable (trigger/growth)
 *     → WorldSession broadcasts semantic events
 *       (new_word_learned / user.emotion_detected / conversation_milestone)
 *     → mds-core dispatches entity.skills.practiceDeclared()
 *     → proficiency moves (the numbers in /status finally mean growth)
 *
 * Requires mds-core with F1 (practiceDeclared). Skipped gracefully on
 * older engines so the suite stays green against published 5.11.1.
 */

import { test, expect, describe, beforeAll } from 'bun:test'
import { unlinkSync, existsSync } from 'fs'
import { SkillSystem } from '@v1b3x0r/mds-core'

const SESSION_FILE = '.hi-introvert-session.json'
const engineHasF1 = typeof (new SkillSystem() as any).practiceDeclared === 'function'

beforeAll(() => {
  console.log = () => {}
  console.info = () => {}
  console.warn = () => {}
  if (existsSync(SESSION_FILE)) {
    try { unlinkSync(SESSION_FILE) } catch {}
  }
})

describe.skipIf(!engineHasF1)('skill growth via declarative triggers (F1)', () => {
  test('learning a new word advances the learning skill', async () => {
    const { WorldSession } = await import('../src/session/WorldSession')
    const session = new WorldSession()
    session.setSilentMode(true)

    const companion = session.companionEntity.entity
    const before = companion.skills!.getSkill('learning')!.proficiency

    await session.handleUserMessage('วันนี้เจอคำว่า quixotic มาด้วยนะ')

    const after = companion.skills!.getSkill('learning')!.proficiency
    expect(after).toBeGreaterThan(before)
  })

  test('detected user emotion advances the empathy skill', async () => {
    const { WorldSession } = await import('../src/session/WorldSession')
    const session = new WorldSession()
    session.setSilentMode(true)

    const companion = session.companionEntity.entity
    const before = companion.skills!.getSkill('empathy')!.proficiency

    await session.handleUserMessage('เศร้ามากเลยวันนี้ ร้องไห้ทั้งวัน')

    const after = companion.skills!.getSkill('empathy')!.proficiency
    expect(after).toBeGreaterThan(before)
  })

  test('every 10th conversation advances the conversation skill', async () => {
    const { WorldSession } = await import('../src/session/WorldSession')
    const session = new WorldSession()
    session.setSilentMode(true)

    const companion = session.companionEntity.entity
    const before = companion.skills!.getSkill('conversation')!.proficiency

    for (let i = 0; i < 10; i++) {
      await session.handleUserMessage(`คุยกันต่อนะ รอบที่ ${i}`)
    }

    const after = companion.skills!.getSkill('conversation')!.proficiency
    expect(after).toBeGreaterThan(before)
  })

  test('skills NOT matching the event stay put (creativity has no trigger)', async () => {
    const { WorldSession } = await import('../src/session/WorldSession')
    const session = new WorldSession()
    session.setSilentMode(true)

    const companion = session.companionEntity.entity
    const before = companion.skills!.getSkill('creativity')!.proficiency

    await session.handleUserMessage('คำใหม่ครับ serendipity')

    expect(companion.skills!.getSkill('creativity')!.proficiency).toBe(before)
  })
})
