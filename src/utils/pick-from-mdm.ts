/**
 * Sample a dialogue line directly from MDM data, bypassing entity.speak().
 *
 * Workaround for [mds-core issue #10](https://github.com/v1b3x0r/mds/issues/10):
 * entity.speak(category) deterministically returns the first matching line,
 * so anti-repeat retry loops can't help. We read the MDM dialogue array
 * ourselves and pick a non-recent line at random.
 *
 * Pure function — caller owns the "recent" history.
 */

export function pickFromMDM(
  mdm: any,
  category: string,
  recent: readonly string[],
  random: () => number = Math.random,
): string | null {
  const lines = mdm?.dialogue?.[category]
  if (!Array.isArray(lines)) return null

  const candidates: string[] = []
  for (const line of lines) {
    const text = line?.lang?.th ?? line?.lang?.en ?? line?.text
    if (typeof text === 'string' && text.length > 0) {
      candidates.push(text)
    }
  }
  if (candidates.length === 0) return null

  const fresh = candidates.filter(c => !recent.includes(c))
  const pool = fresh.length > 0 ? fresh : candidates
  const idx = Math.floor(random() * pool.length)
  return pool[idx] ?? null
}
