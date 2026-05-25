import { test, expect, describe } from 'bun:test'
import { computeMoonPhase } from '../src/sensors/MoonSensor'

describe('MoonSensor', () => {
  test('new moon = phase near 0, illumination near 0', () => {
    // 2026-01-18 was very close to new moon (UTC)
    const result = computeMoonPhase(new Date('2026-01-18T12:00:00Z'))
    expect(result.illumination).toBeLessThan(0.1)
  })

  test('full moon = phase near 0.5, illumination near 1', () => {
    // 2026-02-01 was a full moon (UTC)
    const result = computeMoonPhase(new Date('2026-02-01T12:00:00Z'))
    expect(result.illumination).toBeGreaterThan(0.95)
    expect(result.name).toBe('full_moon')
  })

  test('returns phase between 0 and 1', () => {
    const result = computeMoonPhase(new Date())
    expect(result.phase).toBeGreaterThanOrEqual(0)
    expect(result.phase).toBeLessThan(1)
  })

  test('returns valid MoonName', () => {
    const result = computeMoonPhase(new Date())
    expect([
      'new_moon', 'waxing_crescent', 'first_quarter', 'waxing_gibbous',
      'full_moon', 'waning_gibbous', 'last_quarter', 'waning_crescent',
    ]).toContain(result.name)
  })
})
