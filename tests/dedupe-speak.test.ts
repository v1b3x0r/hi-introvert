import { test, expect, describe } from 'bun:test'
import { dedupeSpeak } from '../src/utils/dedupe-speak'

describe('dedupeSpeak', () => {
  test('accepts first line when no recent history', () => {
    const r = dedupeSpeak(() => 'A', [])
    expect(r.line).toBe('A')
    expect(r.updatedRecent).toEqual(['A'])
  })

  test('rerolls when speaker returns a recently-spoken line', () => {
    const lines = ['A', 'A', 'B']
    let i = 0
    const r = dedupeSpeak(() => lines[i++], ['A'])
    expect(r.line).toBe('B')
    expect(r.updatedRecent).toEqual(['A', 'B'])
  })

  test('gives up after maxAttempts and returns last roll', () => {
    let calls = 0
    const r = dedupeSpeak(() => { calls++; return 'A' }, ['A'], 3)
    expect(r.line).toBe('A')
    expect(calls).toBeGreaterThanOrEqual(3)
    expect(r.updatedRecent).toEqual(['A']) // unchanged — didn't accept
  })

  test('caps history to 3 entries', () => {
    let i = 0
    const seq = ['B', 'C', 'D']
    const r = dedupeSpeak(() => seq[i++], ['A1', 'A2', 'A3'])
    expect(r.line).toBe('B')
    expect(r.updatedRecent.length).toBe(3)
    expect(r.updatedRecent).toEqual(['A2', 'A3', 'B'])
  })

  test('returns undefined when speaker returns undefined', () => {
    const r = dedupeSpeak(() => undefined, ['A'])
    expect(r.line).toBeUndefined()
    expect(r.updatedRecent).toEqual(['A'])
  })

  test('passes through when speaker varies naturally', () => {
    let i = 0
    const seq = ['X', 'Y', 'Z']
    const r = dedupeSpeak(() => seq[i++], ['Q'])
    expect(r.line).toBe('X')
    expect(r.updatedRecent).toEqual(['Q', 'X'])
  })
})
