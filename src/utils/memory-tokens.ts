/**
 * Extract and boost tokens from companion memories so proto-language has
 * a higher chance of surfacing recently-relevant words (names, topics, etc.).
 *
 * Rationale: memory.recall returns memories that match the user's question,
 * but the response pipeline previously only used them as a "is anything
 * relevant?" boolean. Words inside the memory content (e.g. "วุตตี้" from
 * "ผมชื่อ วุตตี้") were stored in vocab but had only ~0.7% chance of being
 * sampled by proto-lang. Boosting biases the distribution toward what the
 * companion was just asked about — emergent recall, not hardcoded lookup.
 */

import { tokenize } from './tokenize.js'

const MAX_DEPTH = 3
// Metadata keys whose values are categorical labels (intent, source, type)
// not natural language. We skip these so labels like "statement" or
// "question" don't pollute the proto-language vocabulary.
const META_KEYS = new Set(['intent', 'type', 'source', 'subject', 'kind', 'category'])

function collectStrings(v: unknown, out: string[], depth: number): void {
  if (depth > MAX_DEPTH) return
  if (typeof v === 'string') { out.push(v); return }
  if (Array.isArray(v)) { for (const x of v) collectStrings(x, out, depth + 1); return }
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (META_KEYS.has(k)) continue
      collectStrings(val, out, depth + 1)
    }
  }
}

export function tokensFromMemoryContent(content: unknown): string[] {
  if (content == null) return []
  const strings: string[] = []
  collectStrings(content, strings, 0)
  return strings.flatMap(s => tokenize(s))
}

interface MemoryLike {
  content?: unknown
  salience?: number
}

/**
 * Build a list of memory tokens with each token duplicated proportional
 * to its memory's salience and the global boost factor. Resulting list
 * is meant to be concatenated into a proto-language vocabulary pool.
 */
export function boostedTokensFromMemories(
  memories: readonly MemoryLike[],
  boost: number = 5,
): string[] {
  const result: string[] = []
  for (const m of memories) {
    if (!m) continue
    const tokens = tokensFromMemoryContent(m.content)
    if (tokens.length === 0) continue
    // Dedupe within a single memory's tokens before interleaving so each
    // unique word competes fairly for the first-10 sampling window in
    // mds-core's generate().
    const unique = [...new Set(tokens)]
    const factor = Math.max(1, Math.round((m.salience ?? 0.5) * boost))
    // Round-robin: [a, b, c, a, b, c, …] not [a, a, a, b, b, b, …]
    for (let i = 0; i < factor; i++) {
      for (const t of unique) result.push(t)
    }
  }
  return result
}
