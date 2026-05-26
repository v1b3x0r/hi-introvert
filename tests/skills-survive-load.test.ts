/**
 * Bug 3: after loadSessionWithHistory replaces companion entity with the
 * deserialized one, companion.skills was undefined → UI displayed "cnv00
 * cre00 emp00 lrn00" regardless of the baseline proficiencies set in
 * initializeCompanionSkills.
 *
 * Fix: post-load, re-enable the skills system + re-add baseline skills
 * so getSkill('conversation')?.proficiency returns 0.3 (not undefined).
 */

import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { unlinkSync, existsSync } from 'fs'

const SESSION_FILE = '.test-skills-survive.json'

beforeAll(() => {
  console.log = () => {}
  console.info = () => {}
  console.warn = () => {}
})

afterAll(() => {
  if (existsSync(SESSION_FILE)) {
    try { unlinkSync(SESSION_FILE) } catch {}
  }
})

describe('skills survive loadSessionWithHistory (Bug 3)', () => {
  test('companion.skills.getSkill returns baseline proficiency after load', async () => {
    const { WorldSession } = await import('../src/session/WorldSession')

    // Step 1 — fresh session, save it.
    const s1 = new WorldSession()
    s1.setSilentMode(true)
    await s1.handleUserMessage('hi')
    s1.saveSessionWithHistory(SESSION_FILE, [])

    // Step 2 — fresh session, load the file.
    const s2 = new WorldSession()
    s2.setSilentMode(true)
    const result = s2.loadSessionWithHistory(SESSION_FILE)
    expect(result.success).toBe(true)

    const companion = s2.companionEntity.entity
    const skills = (companion as any).skills
    expect(skills).toBeDefined()

    // Baseline values from initializeCompanionSkills
    expect(skills.getSkill('conversation')?.proficiency).toBeGreaterThan(0)
    expect(skills.getSkill('creativity')?.proficiency).toBeGreaterThan(0)
    expect(skills.getSkill('empathy')?.proficiency).toBeGreaterThan(0)
    expect(skills.getSkill('learning')?.proficiency).toBeGreaterThan(0)
  })
})
