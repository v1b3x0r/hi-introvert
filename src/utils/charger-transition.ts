/**
 * Charger transition detection — turns battery state samples into
 * "ritual" events (plug = arrival, unplug = departure).
 *
 * Pure functions. The actual sampling lives in WorldSession alongside
 * OSSensor, so we don't add another polling loop.
 */

export interface ChargingState {
  charging: boolean
  batteryLevel: number  // 0..1
}

export interface ChargerTransition {
  connected: boolean
  batteryLevel: number
  hour: number          // 0..23
  isLateNight: boolean  // hour ∈ [0, 5)
}

export function detectChargerTransition(
  prev: boolean | null,
  curr: ChargingState,
  now: Date = new Date(),
): ChargerTransition | null {
  if (prev === null || prev === curr.charging) return null
  const hour = now.getHours()
  return {
    connected: curr.charging,
    batteryLevel: curr.batteryLevel,
    hour,
    isLateNight: hour >= 0 && hour < 5,
  }
}

/**
 * Salience for entity memory. Late-night plug-ins are sticky
 * (companion will remember them longer); daytime transitions
 * are ambient background.
 */
export function transitionSalience(t: ChargerTransition): number {
  return t.isLateNight ? 0.8 : 0.4
}
