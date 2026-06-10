/**
 * Format world event log for the /history command.
 */

interface WorldEvent {
  time: number
  type: string
  data?: unknown
}

const MAX_EVENTS = 20

export function formatEventLog(events: WorldEvent[]): string {
  if (events.length === 0) return 'no world events yet'

  const tail = events.slice(-MAX_EVENTS)
  const header = events.length > MAX_EVENTS
    ? `world events (last ${MAX_EVENTS} of ${events.length}):`
    : `world events (${events.length}):`

  const lines = tail.map(e => `  ${e.time.toFixed(0).padStart(5)}s  ${e.type}`)
  return [header, ...lines].join('\n')
}
