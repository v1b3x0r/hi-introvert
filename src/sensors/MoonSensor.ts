/**
 * Moon phase sensor — computes phase from date, no network.
 * Uses standard synodic-month approximation (29.530588853 days).
 * Reference new moon: 2000-01-06 18:14 UTC.
 */

const LUNAR_MONTH_DAYS = 29.530588853
const KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z').getTime()

export type MoonName =
  | 'new_moon' | 'waxing_crescent' | 'first_quarter' | 'waxing_gibbous'
  | 'full_moon' | 'waning_gibbous' | 'last_quarter' | 'waning_crescent'

export interface MoonPhase {
  phase: number          // 0..1
  illumination: number   // 0..1
  name: MoonName
}

export function computeMoonPhase(date: Date = new Date()): MoonPhase {
  const days = (date.getTime() - KNOWN_NEW_MOON) / (1000 * 60 * 60 * 24)
  const raw = (days % LUNAR_MONTH_DAYS) / LUNAR_MONTH_DAYS
  const phase = ((raw % 1) + 1) % 1
  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2

  let name: MoonName
  if (phase < 0.03 || phase > 0.97) name = 'new_moon'
  else if (phase < 0.22) name = 'waxing_crescent'
  else if (phase < 0.28) name = 'first_quarter'
  else if (phase < 0.47) name = 'waxing_gibbous'
  else if (phase < 0.53) name = 'full_moon'
  else if (phase < 0.72) name = 'waning_gibbous'
  else if (phase < 0.78) name = 'last_quarter'
  else name = 'waning_crescent'

  return { phase, illumination, name }
}
