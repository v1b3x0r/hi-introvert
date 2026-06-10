import { test, expect, describe } from 'bun:test'
import { OSSensor, memoryUsageFromVmStat, applyWeatherToEnvironment } from '../src/sensors/OSSensor'
import type { OSMetrics, EnvironmentMapping } from '../src/sensors/OSSensor'

function metricsWith(overrides: Partial<OSMetrics>): OSMetrics {
  return {
    cpuUsage: 0,
    cpuTemp: 313,
    memoryUsage: 0.5,
    memoryPressure: 0,
    batteryLevel: 1,
    batteryCharging: true,
    uptime: 0,
    loadAverage: [0, 0, 0],
    timestamp: 0,
    ...overrides,
  }
}

describe('OSSensor temperature mapping', () => {
  const sensor = new OSSensor()

  test('idle CPU maps to neutral room temperature (293K / 20°C)', () => {
    const env = sensor.mapToEnvironment(metricsWith({ cpuUsage: 0, cpuTemp: 313 }))
    expect(env.temperature).toBeCloseTo(293, 0)
  })

  test('full CPU load maps to 323K (50°C), not beyond', () => {
    const env = sensor.mapToEnvironment(metricsWith({ cpuUsage: 1, cpuTemp: 353 }))
    expect(env.temperature).toBeCloseTo(323, 0)
    expect(env.temperature).toBeLessThanOrEqual(323)
  })

  test('moderate load stays inside the documented 283-323K range', () => {
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      const env = sensor.mapToEnvironment(metricsWith({ cpuUsage: u, cpuTemp: 313 + u * 40 }))
      expect(env.temperature).toBeGreaterThanOrEqual(283)
      expect(env.temperature).toBeLessThanOrEqual(323)
    }
  })

  test('idle machine does not read as hot (>30°C) — the "ร้อนเกินจริง" regression', () => {
    const env = sensor.mapToEnvironment(metricsWith({ cpuUsage: 0.05, cpuTemp: 315 }))
    expect(env.temperature - 273).toBeLessThan(30)
  })
})

describe('memoryUsageFromVmStat (macOS honest memory)', () => {
  // Trimmed real vm_stat shape: page size 16384, values in pages.
  const vmstat = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                               50000.
Pages active:                            300000.
Pages inactive:                          200000.
Pages speculative:                        30000.
Pages throttled:                              0.
Pages wired down:                        100000.
Pages purgeable:                          20000.
"Translation faults":                 123456789.
`

  test('counts free+inactive+speculative+purgeable as available', () => {
    // available = (50000+200000+30000+20000) * 16384 = 300000 pages
    // total = 1,000,000 pages * 16384
    const totalMem = 1_000_000 * 16384
    const usage = memoryUsageFromVmStat(vmstat, totalMem)
    expect(usage).toBeCloseTo(0.7, 2)
  })

  test('returns null on unparseable output (caller falls back to os.freemem)', () => {
    expect(memoryUsageFromVmStat('garbage', 16384)).toBeNull()
  })
})

describe('applyWeatherToEnvironment (idempotent weather composition)', () => {
  const base: EnvironmentMapping = {
    temperature: 293,
    humidity: 0.4,
    light: 0.8,
    windVx: 10,
    windVy: -5,
  }
  const rain = { rain: true, rainIntensity: 0.5, cloudCover: 0.6, windStrength: 1.5 }

  test('no rain returns base unchanged', () => {
    const out = applyWeatherToEnvironment(base, { rain: false, rainIntensity: 0, cloudCover: 0, windStrength: 1 })
    expect(out).toEqual(base)
  })

  test('rain raises humidity and dims light from the BASE values', () => {
    const out = applyWeatherToEnvironment(base, rain)
    expect(out.humidity).toBeCloseTo(Math.min(1, 0.4 + 0.5 * 0.3), 5)
    expect(out.light).toBeCloseTo(Math.max(0.2, 0.8 * (1 - 0.6)), 5)
    expect(out.windVx).toBeCloseTo(15, 5)
  })

  test('applying twice equals applying once (no compounding between ticks)', () => {
    const once = applyWeatherToEnvironment(base, rain)
    const twice = applyWeatherToEnvironment(base, rain)
    expect(twice).toEqual(once)
    // and re-deriving from base (the WorldSession pattern) never drifts:
    let current = base
    for (let i = 0; i < 5; i++) current = applyWeatherToEnvironment(base, rain)
    expect(current).toEqual(once)
  })
})
