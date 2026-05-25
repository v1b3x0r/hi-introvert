import { test, expect, describe } from 'bun:test'
import { toText } from '../src/utils/to-text'

describe('toText', () => {
  test('returns string as-is', () => {
    expect(toText('hello')).toBe('hello')
  })

  test('null and undefined → empty string', () => {
    expect(toText(null)).toBe('')
    expect(toText(undefined)).toBe('')
  })

  test('number and boolean → string repr', () => {
    expect(toText(42)).toBe('42')
    expect(toText(true)).toBe('true')
  })

  test('object → JSON repr (prevents React child crash)', () => {
    const obj = { name: 'companion', response: 'hi' }
    expect(toText(obj)).toBe('{"name":"companion","response":"hi"}')
  })

  test('circular structures fall back to String()', () => {
    const a: any = {}
    a.self = a
    const result = toText(a)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  test('MessageResponse object regression — would crash React without coercion', () => {
    const messageResponse = {
      name: 'companion',
      response: 'หวัดดี',
      emotion: { valence: 0.5, arousal: 0.3 },
      previousValence: 0,
    }
    // Before fix: someone passed entire MessageResponse as `text` in Message.
    // toText must produce a string, not the raw object.
    const result = toText(messageResponse)
    expect(typeof result).toBe('string')
    expect(result).toContain('หวัดดี')
  })
})
