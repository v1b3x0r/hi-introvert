/**
 * Anti-repeat wrapper for entity.speak() calls.
 *
 * Workaround for a quirk in @v1b3x0r/mds-core where `entity.speak(category)`
 * tends to return the same dialogue line repeatedly even when the MDM
 * file has many lines available. We retry up to `maxAttempts` times if
 * the line was recently spoken, and remember the last few lines so we
 * don't repeat ourselves on subsequent calls.
 */

const HISTORY_SIZE = 3

export interface DedupeResult {
  line: string | undefined
  updatedRecent: string[]
}

export function dedupeSpeak(
  speak: () => string | undefined,
  recent: string[],
  maxAttempts: number = 5,
): DedupeResult {
  let last: string | undefined
  for (let i = 0; i < maxAttempts; i++) {
    last = speak()
    if (last === undefined) return { line: undefined, updatedRecent: recent }
    if (!recent.includes(last)) {
      return {
        line: last,
        updatedRecent: [...recent, last].slice(-HISTORY_SIZE),
      }
    }
  }
  return { line: last, updatedRecent: recent }
}
