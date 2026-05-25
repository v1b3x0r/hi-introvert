/**
 * Word tokenization with Thai + English + Unicode support.
 *
 * Uses ICU word segmentation (Intl.Segmenter) — built-in to Node 18+ / Bun.
 * The 'th' locale enables Thai dictionary-based segmentation while still
 * handling whitespace-separated scripts correctly.
 *
 * Thai particle fix: ICU's Thai dictionary inconsistently handles
 * sentence-final particles (อะ, อ่ะ, นะ, เนอะ, ฮะ) when they're attached
 * to the preceding word — e.g. "ง่วงแล้วอะ" → ["ง่วง","แล้","วอะ"] instead
 * of ["ง่วง","แล้ว","อะ"]. We insert a space before such particles when
 * they appear at end-of-string or before non-Thai characters; ICU then
 * segments cleanly. Particles in mid-word context (e.g. "อะไร") are left
 * alone via the lookbehind/lookahead constraints.
 */

const segmenter = new Intl.Segmenter('th', { granularity: 'word' })

// Thai script range: U+0E01–U+0E5B (consonants, vowels, tone marks, digits)
const PARTICLE_BOUNDARY = /(?<=[ก-๛])(อ่?ะ|อ้ะ|น่?ะ|เนอะ|ฮะ)(?=$|\s|[^ก-๛])/g

function preProcessThai(message: string): string {
  return message.replace(PARTICLE_BOUNDARY, ' $1')
}

export function tokenize(message: string): string[] {
  const tokens: string[] = []
  const prepped = preProcessThai(message)
  for (const { segment, isWordLike } of segmenter.segment(prepped)) {
    if (!isWordLike) continue
    if (!/\p{L}/u.test(segment)) continue
    tokens.push(segment)
  }
  return tokens
}
