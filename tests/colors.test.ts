import { test, expect, describe } from 'bun:test'
import { emotionToColor, COLORS } from '../src/ui/ink/colors'

describe('emotionToColor', () => {
  test('positive valence → hex string', () => {
    const color = emotionToColor({ valence: 0.8, arousal: 0.5 })
    expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  test('negative valence → hex string', () => {
    const color = emotionToColor({ valence: -0.7, arousal: 0.3 })
    expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  test('neutral valence returns hex', () => {
    const color = emotionToColor({ valence: 0, arousal: 0 })
    expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  test('positive vs negative produce different colors', () => {
    const happy = emotionToColor({ valence: 0.9, arousal: 0.5 })
    const sad = emotionToColor({ valence: -0.9, arousal: 0.5 })
    expect(happy).not.toBe(sad)
  })

  test('COLORS palette exports expected keys', () => {
    expect(COLORS.userText).toMatch(/^#[0-9a-f]{6}$/i)
    expect(COLORS.systemText).toMatch(/^#[0-9a-f]{6}$/i)
    expect(COLORS.border).toMatch(/^#[0-9a-f]{6}$/i)
    expect(Array.isArray(COLORS.banner)).toBe(true)
  })
})
