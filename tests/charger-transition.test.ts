import { test, expect, describe } from 'bun:test'
import {
  detectChargerTransition,
  transitionSalience,
} from '../src/utils/charger-transition'

describe('detectChargerTransition', () => {
  test('returns null on first reading (no previous state)', () => {
    const t = detectChargerTransition(null, { charging: true, batteryLevel: 0.8 })
    expect(t).toBeNull()
  })

  test('returns null when state unchanged', () => {
    const t = detectChargerTransition(true, { charging: true, batteryLevel: 0.8 })
    expect(t).toBeNull()
  })

  test('detects unplug → plug transition', () => {
    const t = detectChargerTransition(
      false,
      { charging: true, batteryLevel: 0.45 },
      new Date('2026-05-24T14:30:00'),
    )
    expect(t).not.toBeNull()
    expect(t!.connected).toBe(true)
    expect(t!.batteryLevel).toBe(0.45)
    expect(t!.hour).toBe(14)
    expect(t!.isLateNight).toBe(false)
  })

  test('detects plug → unplug transition', () => {
    const t = detectChargerTransition(
      true,
      { charging: false, batteryLevel: 0.95 },
      new Date('2026-05-24T09:15:00'),
    )
    expect(t).not.toBeNull()
    expect(t!.connected).toBe(false)
  })

  test('flags late-night transitions (hour 0–4)', () => {
    const t = detectChargerTransition(
      false,
      { charging: true, batteryLevel: 0.3 },
      new Date('2026-05-24T02:47:00'),
    )
    expect(t!.isLateNight).toBe(true)
  })

  test('hour 5 is no longer late-night', () => {
    const t = detectChargerTransition(
      false,
      { charging: true, batteryLevel: 0.3 },
      new Date('2026-05-24T05:00:00'),
    )
    expect(t!.isLateNight).toBe(false)
  })
})

describe('transitionSalience', () => {
  test('late-night transitions get high salience', () => {
    const s = transitionSalience({
      connected: true, batteryLevel: 0.3, hour: 3, isLateNight: true,
    })
    expect(s).toBe(0.8)
  })

  test('daytime transitions get medium salience', () => {
    const s = transitionSalience({
      connected: true, batteryLevel: 0.5, hour: 14, isLateNight: false,
    })
    expect(s).toBe(0.4)
  })
})
