/**
 * Unit tests for name-introduction detector.
 *
 * Covers the phrasings the live binary sees in practice:
 *   - Thai: ผมชื่อ X / ฉันชื่อ X / เรียกผมว่า X
 *   - English: I'm X / I am X / My name is X / My name's X / My name X / call me X
 *
 * Plus the false-positive guards: "I'm sad/tired/here/ok" must NOT be parsed
 * as names — common state-words after "I'm" are blocked.
 */

import { test, expect, describe } from 'bun:test'
import { extractNameIntroduction } from '../src/utils/name-detect'

describe('name-detect — Thai phrasings', () => {
  test('ผมชื่อ Wutty', () => {
    expect(extractNameIntroduction('ผมชื่อ Wutty')?.name).toBe('Wutty')
  })
  test('ฉันชื่อ วุตตี้', () => {
    expect(extractNameIntroduction('ฉันชื่อ วุตตี้')?.name).toBe('วุตตี้')
  })
  test('เรียกผมว่า บอย', () => {
    expect(extractNameIntroduction('เรียกผมว่า บอย')?.name).toBe('บอย')
  })
  test('สวัสดีครับ ผมชื่อ Wutty (greeting prefix)', () => {
    expect(extractNameIntroduction('สวัสดีครับ ผมชื่อ Wutty')?.name).toBe('Wutty')
  })
})

describe('name-detect — English phrasings', () => {
  test('I\'m Wutty', () => {
    expect(extractNameIntroduction("I'm Wutty")?.name).toBe('Wutty')
  })
  test('I am Wutty', () => {
    expect(extractNameIntroduction('I am Wutty')?.name).toBe('Wutty')
  })
  test('My name is Wutty', () => {
    expect(extractNameIntroduction('My name is Wutty')?.name).toBe('Wutty')
  })
  test('My name\'s Wutty', () => {
    expect(extractNameIntroduction("My name's Wutty")?.name).toBe('Wutty')
  })
  test('My name Wutty (no copula)', () => {
    expect(extractNameIntroduction('My name Wutty')?.name).toBe('Wutty')
  })
  test('call me Wutty', () => {
    expect(extractNameIntroduction('call me Wutty')?.name).toBe('Wutty')
  })
  test('I\'m called Wutty', () => {
    expect(extractNameIntroduction("I'm called Wutty")?.name).toBe('Wutty')
  })
})

describe('name-detect — false-positive guards', () => {
  test('I\'m sad → not a name', () => {
    expect(extractNameIntroduction("I'm sad")).toBeNull()
  })
  test('I\'m tired → not a name', () => {
    expect(extractNameIntroduction("I'm tired")).toBeNull()
  })
  test('I\'m here → not a name', () => {
    expect(extractNameIntroduction("I'm here")).toBeNull()
  })
  test('I am ok → not a name', () => {
    expect(extractNameIntroduction('I am ok')).toBeNull()
  })
  test('I\'m bored → not a name', () => {
    expect(extractNameIntroduction("I'm bored")).toBeNull()
  })
  test('plain hi → no match', () => {
    expect(extractNameIntroduction('hi')).toBeNull()
  })
  test('empty message → no match', () => {
    expect(extractNameIntroduction('')).toBeNull()
  })
})
