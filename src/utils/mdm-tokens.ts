/**
 * Extract companion-specific vocabulary tokens from MDM dialogue.
 *
 * The set difference vs. base vocabulary is load-bearing: without it,
 * function words like ฉัน/ที่/ได้/เป็น that appear in both MDM and base
 * vocab would get duplicated into the proto-language pool and out-weight
 * the companion-specific words (เงียบ/ลึก/ภายใน/บางที) that this function
 * is meant to surface.
 *
 * Pure function — caller computes once and caches.
 */

import { tokenize } from './tokenize.js'

export function extractCompanionTokens(
  mdm: any,
  baseVocabulary: readonly string[],
): string[] {
  const baseSet = new Set(baseVocabulary)
  const seen = new Set<string>()
  const out: string[] = []

  const dialogueCategories: string[] = ['intro', 'self_monologue']
  const dialogue = mdm?.dialogue ?? {}

  for (const category of dialogueCategories) {
    const lines = dialogue[category]
    if (!Array.isArray(lines)) continue

    for (const entry of lines) {
      if (!entry || typeof entry !== 'object') continue
      const lang = (entry as any).lang
      if (!lang || typeof lang !== 'object') continue

      for (const langKey of ['th', 'en']) {
        const text = (lang as any)[langKey]
        if (typeof text !== 'string' || text.length === 0) continue

        for (const tok of tokenize(text)) {
          const t = tok.toLowerCase()
          if (t.length < 2) continue
          if (baseSet.has(t)) continue
          if (seen.has(t)) continue
          seen.add(t)
          out.push(t)
        }
      }
    }
  }

  return out
}
