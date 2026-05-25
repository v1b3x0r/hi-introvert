/**
 * Defensive coercion to string for any value rendered as a React child.
 * Prevents "Objects are not valid as a React child" crashes when a message
 * payload has an unexpected shape (e.g. old save file with object `text`).
 */
export function toText(v: unknown): string {
  if (typeof v === 'string') return v
  if (v == null) return ''
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}
