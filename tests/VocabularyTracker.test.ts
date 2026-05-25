import { test, expect, describe } from 'bun:test'
import { VocabularyTracker } from '../src/vocabulary/VocabularyTracker'

describe('VocabularyTracker — Thai tokenization', () => {
  test('segments Thai sentence into multiple words', () => {
    const tracker = new VocabularyTracker()
    // "สวัสดีครับวันนี้อากาศดี" should tokenize into: สวัสดี, ครับ, วัน, นี้, อากาศ, ดี
    // 5 of 6 are in BASE_VOCABULARY (everything except 'อากาศ')
    const coverage = tracker.getCoverage('สวัสดีครับวันนี้อากาศดี')
    expect(coverage).toBeGreaterThan(0.5)
  })

  test('learns new Thai words from message without whitespace', () => {
    const tracker = new VocabularyTracker()
    const newWords = tracker.detectNewWords('อากาศวันนี้ฝนตกหนัก')
    // Expected segments: อากาศ, วัน, นี้, ฝน, ตก, หนัก — at least 'อากาศ', 'ตก', 'หนัก' are new
    expect(newWords.length).toBeGreaterThan(0)
    expect(newWords).toContain('อากาศ')
  })

  test('English still works (space-separated)', () => {
    const tracker = new VocabularyTracker()
    const coverage = tracker.getCoverage('hello friend i love music')
    // All 5 are in base vocab
    expect(coverage).toBe(1)
  })

  test('mixed Thai-English splits correctly', () => {
    const tracker = new VocabularyTracker()
    const coverage = tracker.getCoverage('hello สวัสดี ครับ friend')
    // All 4 are in base vocab
    expect(coverage).toBe(1)
  })

  test('punctuation does not pollute tokens', () => {
    const tracker = new VocabularyTracker()
    const newWords = tracker.detectNewWords('ขอบคุณ, มาก! ครับ.')
    // No punctuation should leak into learned words
    for (const w of newWords) {
      expect(w).not.toMatch(/[,.!?;:]/)
    }
  })

  test('ignores whitespace/punctuation as standalone tokens', () => {
    const tracker = new VocabularyTracker()
    const newWords = tracker.detectNewWords('สวัสดี!!! ครับ???')
    // Should not learn '!!!' or '???' as new "words"
    expect(newWords.every(w => /\p{L}/u.test(w))).toBe(true)
  })
})
