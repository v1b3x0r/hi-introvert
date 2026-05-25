import { test, expect, describe } from 'bun:test'
import { tokenize } from '../src/utils/tokenize'

describe('tokenize util', () => {
  test('segments pure Thai without spaces', () => {
    expect(tokenize('สวัสดีครับวันนี้อากาศดี')).toEqual([
      'สวัสดี', 'ครับ', 'วัน', 'นี้', 'อากาศ', 'ดี',
    ])
  })

  test('segments pure English on word boundaries', () => {
    expect(tokenize('hello dear friend')).toEqual(['hello', 'dear', 'friend'])
  })

  test('handles mixed Thai-English', () => {
    const result = tokenize('hello สวัสดี ครับ friend')
    expect(result).toEqual(['hello', 'สวัสดี', 'ครับ', 'friend'])
  })

  test('drops punctuation and whitespace', () => {
    expect(tokenize('ขอบคุณ, มาก!  ครับ.')).toEqual(['ขอบคุณ', 'มาก', 'ครับ'])
  })

  test('drops pure numbers/symbols (keeps only letter-bearing tokens)', () => {
    const result = tokenize('hello 123 !!! สวัสดี')
    expect(result).toEqual(['hello', 'สวัสดี'])
  })

  test('returns empty array for empty input', () => {
    expect(tokenize('')).toEqual([])
  })

  test('handles Thai with emphasis lengthening (กกก)', () => {
    // "ดีมากกก" — ICU may segment as "ดี", "มากกก" or "ดี", "มาก", "กก"
    // Just verify it returns multiple tokens, not the whole thing
    const result = tokenize('ดีมากกก')
    expect(result.length).toBeGreaterThan(1)
  })

  describe('Thai sentence-final particle fixes', () => {
    test('"ง่วงแล้วอะ" segments as ง่วง + แล้ว + อะ (was: แล้/วอะ)', () => {
      const result = tokenize('ง่วงแล้วอะ')
      expect(result).toContain('แล้ว')
      expect(result).toContain('อะ')
      expect(result).not.toContain('แล้')
      expect(result).not.toContain('วอะ')
    })

    test('"ดีเนอะ" segments as ดี + เนอะ (was: เนอ/ะ)', () => {
      const result = tokenize('ดีเนอะ')
      expect(result).toContain('ดี')
      expect(result).toContain('เนอะ')
    })

    test('"ดีนะ" segments as ดี + นะ (was: ดีนะ as one)', () => {
      const result = tokenize('ดีนะ')
      expect(result).toContain('ดี')
      expect(result).toContain('นะ')
    })

    test('does NOT split "อะไร" (อะ is mid-word here)', () => {
      const result = tokenize('อะไร')
      expect(result).toContain('อะไร')
    })

    test('handles particles at end of multi-word sentences', () => {
      const result = tokenize('เรื่องอะไรนะ')
      expect(result).toContain('เรื่อง')
      expect(result).toContain('อะไร')
      expect(result).toContain('นะ')
    })

    test('does not regress correctly-segmented inputs', () => {
      const result = tokenize('ผมชื่อบ้าน')
      expect(result).toEqual(['ผม', 'ชื่อ', 'บ้าน'])
    })
  })
})
