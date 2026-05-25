import { test, expect, describe } from 'bun:test'
import { tokensFromMemoryContent, boostedTokensFromMemories } from '../src/utils/memory-tokens'

describe('tokensFromMemoryContent', () => {
  test('extracts tokens from a string field — Thai dictionary words', () => {
    const t = tokensFromMemoryContent({ message: 'ผมชื่อบ้าน' })
    expect(t).toContain('ผม')
    expect(t).toContain('ชื่อ')
    expect(t).toContain('บ้าน')
  })

  test('extracts tokens from English name in message', () => {
    const t = tokensFromMemoryContent({ message: 'My name is Wutty' })
    expect(t).toContain('Wutty')
  })

  test('out-of-dictionary Thai names get fragmented (ICU limitation)', () => {
    // "วุตตี้" is a nickname not in the Thai dictionary; ICU splits it
    // into "วุต" + "ตี้". Proto-lang can still surface either fragment
    // when boosted, which is "close enough" for the emergent feel.
    const t = tokensFromMemoryContent({ message: 'ผมชื่อ วุตตี้' })
    expect(t.length).toBeGreaterThan(2)
    expect(t.some(x => x.includes('วุต') || x.includes('ตี้'))).toBe(true)
  })

  test('flattens nested objects', () => {
    const t = tokensFromMemoryContent({ outer: { inner: 'hello world' } })
    expect(t).toContain('hello')
    expect(t).toContain('world')
  })

  test('handles arrays', () => {
    const t = tokensFromMemoryContent({ tags: ['curious', 'shy'] })
    expect(t).toContain('curious')
    expect(t).toContain('shy')
  })

  test('returns empty array for null/undefined', () => {
    expect(tokensFromMemoryContent(null)).toEqual([])
    expect(tokensFromMemoryContent(undefined)).toEqual([])
  })

  test('bounds recursion depth to prevent runaway nesting', () => {
    const deep: any = { a: { b: { c: { d: { e: { f: 'too_deep_should_skip' } } } } } }
    const t = tokensFromMemoryContent(deep)
    // 'too_deep_should_skip' beyond depth limit
    expect(t).not.toContain('too_deep_should_skip')
  })
})

describe('boostedTokensFromMemories', () => {
  test('boosts tokens by salience', () => {
    const memories = [
      { content: { message: 'แมว' }, salience: 1.0 },
      { content: { message: 'หมา' }, salience: 0.2 },
    ]
    const t = boostedTokensFromMemories(memories, 5)
    const counts = new Map<string, number>()
    for (const w of t) counts.set(w, (counts.get(w) ?? 0) + 1)
    expect(counts.get('แมว')!).toBeGreaterThan(counts.get('หมา') ?? 0)
  })

  test('handles empty memories list', () => {
    expect(boostedTokensFromMemories([], 5)).toEqual([])
  })

  test('skips memories with non-object content', () => {
    const memories = [
      { content: null, salience: 1.0 },
      { content: 'plain string', salience: 1.0 },  // String content, still extract
      { content: { message: 'ดี' }, salience: 1.0 },
    ]
    const t = boostedTokensFromMemories(memories, 1)
    expect(t).toContain('ดี')
    expect(t).toContain('plain')
  })

  test('total tokens scale with boost parameter', () => {
    const memories = [{ content: { message: 'word' }, salience: 1.0 }]
    const t1 = boostedTokensFromMemories(memories, 1)
    const t5 = boostedTokensFromMemories(memories, 5)
    expect(t5.length).toBeGreaterThan(t1.length)
  })
})
