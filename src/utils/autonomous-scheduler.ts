/**
 * Recursive setTimeout scheduler with jitter — drives the companion's
 * proactive self-monologue. Ported from BlessedApp v1.1.1.
 *
 * Why setTimeout chain instead of setInterval:
 * - We want fresh randomness each iteration (15–45s feels natural).
 * - We never want overlapping fires if a trigger takes a while.
 *
 * Timer functions are injectable so tests can use a fake clock.
 */

export interface AutonomousSchedulerOptions {
  minDelay?: number
  maxDelay?: number
  randomFn?: () => number
  setTimer?: (cb: () => void, ms: number) => any
  clearTimer?: (handle: any) => void
}

export function scheduleAutonomous(
  trigger: () => void | Promise<void>,
  options: AutonomousSchedulerOptions = {},
): () => void {
  const {
    minDelay = 15000,
    maxDelay = 45000,
    randomFn = Math.random,
    setTimer = setTimeout as any,
    clearTimer = clearTimeout as any,
  } = options

  let stopped = false
  let handle: any = null

  const next = () => {
    if (stopped) return
    const delay = minDelay + randomFn() * (maxDelay - minDelay)
    handle = setTimer(async () => {
      if (stopped) return
      try {
        await trigger()
      } catch {
        // Silent fail — autonomous messages shouldn't spam errors
      }
      next()
    }, delay)
  }
  next()

  return () => {
    stopped = true
    if (handle) clearTimer(handle)
  }
}
