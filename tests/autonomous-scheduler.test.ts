import { test, expect, describe } from 'bun:test'
import { scheduleAutonomous } from '../src/utils/autonomous-scheduler'

describe('scheduleAutonomous', () => {
  test('fires trigger after the configured delay range and reschedules', async () => {
    const firedAt: number[] = []
    let now = 0
    const timers: Array<{ at: number; cb: () => void }> = []
    const setTimer = (cb: () => void, ms: number) => {
      const handle = { at: now + ms, cb }
      timers.push(handle)
      return handle
    }
    const clearTimer = (h: any) => {
      const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1)
    }
    const advance = async (ms: number) => {
      const target = now + ms
      while (true) {
        const next = timers.filter(t => t.at <= target).sort((a, b) => a.at - b.at)[0]
        if (!next) break
        const i = timers.indexOf(next); if (i >= 0) timers.splice(i, 1)
        now = next.at
        firedAt.push(now)
        await next.cb()
      }
      now = target
    }

    const stop = scheduleAutonomous(
      () => {},
      {
        minDelay: 100,
        maxDelay: 200,
        randomFn: () => 0.5,  // deterministic = 150ms delay
        setTimer: setTimer as any,
        clearTimer,
      },
    )

    // Nothing fires before delay
    await advance(140)
    expect(firedAt.length).toBe(0)

    // First fire at 150ms
    await advance(20)
    expect(firedAt).toEqual([150])

    // Reschedules — next fire at 300ms (150 + 150)
    await advance(160)
    expect(firedAt).toEqual([150, 300])

    stop()
  })

  test('stop() prevents further fires', async () => {
    const fired: number[] = []
    let now = 0
    const timers: Array<{ at: number; cb: () => void }> = []
    const setTimer = (cb: () => void, ms: number) => {
      const h = { at: now + ms, cb }
      timers.push(h)
      return h
    }
    const clearTimer = (h: any) => {
      const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1)
    }
    const advance = async (ms: number) => {
      now += ms
      const due = timers.filter(t => t.at <= now)
      for (const t of due) {
        const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1)
        await t.cb()
      }
    }

    const stop = scheduleAutonomous(
      () => { fired.push(now) },
      { minDelay: 100, maxDelay: 100, randomFn: () => 0, setTimer: setTimer as any, clearTimer },
    )

    await advance(100)
    expect(fired.length).toBe(1)

    stop()
    await advance(500)
    expect(fired.length).toBe(1)  // No more fires after stop
  })

  test('swallows trigger errors and keeps scheduling', async () => {
    let calls = 0
    let now = 0
    const timers: Array<{ at: number; cb: () => void }> = []
    const setTimer = (cb: () => void, ms: number) => {
      const h = { at: now + ms, cb }; timers.push(h); return h
    }
    const clearTimer = (h: any) => {
      const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1)
    }
    const advance = async (ms: number) => {
      now += ms
      const due = timers.filter(t => t.at <= now)
      for (const t of due) {
        const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1)
        await t.cb()
      }
    }

    const stop = scheduleAutonomous(
      async () => {
        calls++
        if (calls === 1) throw new Error('boom')
      },
      { minDelay: 100, maxDelay: 100, randomFn: () => 0, setTimer: setTimer as any, clearTimer },
    )

    await advance(100)
    expect(calls).toBe(1)  // First call threw but scheduler didn't crash

    await advance(100)
    expect(calls).toBe(2)  // Reschedule worked

    stop()
  })
})
