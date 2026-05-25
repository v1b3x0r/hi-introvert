import { test, expect, describe } from 'bun:test'
import { pickFromMDM } from '../src/utils/pick-from-mdm'

const mockMDM = {
  dialogue: {
    self_monologue: [
      { lang: { th: 'อยาก เข้าใจ คน' } },
      { lang: { th: 'บางครั้ง เงียบ ก็ ดี' } },
      { lang: { th: 'ฉัน ยัง ใหม่ มาก' } },
      { lang: { en: 'I am still learning' } },
      { lang: { en: 'Sometimes silence teaches' } },
    ],
    intro: [
      { lang: { th: 'หวัดดี' } },
      { lang: { en: 'Hi' } },
    ],
  },
}

describe('pickFromMDM', () => {
  test('returns null for missing category', () => {
    expect(pickFromMDM(mockMDM, 'nonexistent', [])).toBeNull()
  })

  test('returns null for malformed mdm', () => {
    expect(pickFromMDM(null, 'self_monologue', [])).toBeNull()
    expect(pickFromMDM({}, 'self_monologue', [])).toBeNull()
    expect(pickFromMDM({ dialogue: { self_monologue: [] } }, 'self_monologue', [])).toBeNull()
  })

  test('picks a line from the category', () => {
    const picked = pickFromMDM(mockMDM, 'self_monologue', [])
    const allLines = [
      'อยาก เข้าใจ คน', 'บางครั้ง เงียบ ก็ ดี', 'ฉัน ยัง ใหม่ มาก',
      'I am still learning', 'Sometimes silence teaches',
    ]
    expect(allLines).toContain(picked)
  })

  test('prefers non-recent lines when available', () => {
    // Pin random to index 0 of pool
    const recent = ['อยาก เข้าใจ คน', 'บางครั้ง เงียบ ก็ ดี']
    const picked = pickFromMDM(mockMDM, 'self_monologue', recent, () => 0)
    expect(recent).not.toContain(picked)
  })

  test('falls back to all candidates when every line is recent', () => {
    const recent = [
      'อยาก เข้าใจ คน', 'บางครั้ง เงียบ ก็ ดี', 'ฉัน ยัง ใหม่ มาก',
      'I am still learning', 'Sometimes silence teaches',
    ]
    const picked = pickFromMDM(mockMDM, 'self_monologue', recent, () => 0)
    expect(picked).toBe('อยาก เข้าใจ คน')  // fallback: first in original
  })

  test('produces variety across many calls', () => {
    const seen = new Set<string>()
    let recent: string[] = []
    for (let i = 0; i < 20; i++) {
      const p = pickFromMDM(mockMDM, 'self_monologue', recent)!
      seen.add(p)
      recent = [...recent, p].slice(-3)
    }
    // With 5 candidates and history of 3, expect at least 4 unique over 20 calls
    expect(seen.size).toBeGreaterThanOrEqual(4)
  })
})
