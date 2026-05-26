/**
 * Detect name introductions in user messages.
 *
 * Matches common Thai + English self-introduction patterns and returns the
 * captured name. Returns null when no pattern matches.
 *
 * Used by WorldSession.handleUserMessage to tag identity memories with
 * `subject: 'user_name'` so retrieval can find them across Thai/English
 * question phrasings.
 *
 * False-positive guard: phrases like "I'm sad" / "I am tired" must NOT be
 * captured as names. Common state/feeling words after a bare "I'm/I am"
 * are rejected via the NON_NAME_AFTER_IAM set.
 */

export interface NameIntroduction {
  name: string
}

const PATTERNS: RegExp[] = [
  // ── Thai ─────────────────────────────────────────────────────────────
  // ผมชื่อ X / ฉันชื่อ X / หนูชื่อ X / ดิฉันชื่อ X / กระผมชื่อ X / เราชื่อ X
  /(?:ผม|ฉัน|หนู|ดิฉัน|กระผม|เรา)ชื่อ\s*([^\s,.!?]+)/i,
  // เรียกผมว่า X / เรียกฉันว่า X / เรียกหนูว่า X
  /เรียก(?:ผม|ฉัน|หนู|ดิฉัน)ว่า\s*([^\s,.!?]+)/i,

  // ── English (most specific first) ────────────────────────────────────
  // my name is X / my name's X
  /\bmy\s+name(?:'s|\s+is)\s+([^\s,.!?]+)/i,
  // my name X (no copula)
  /\bmy\s+name\s+([^\s,.!?]+)/i,
  // i'm called X / i am called X
  /\bi(?:'m|\s+am)\s+called\s+([^\s,.!?]+)/i,
  // call me X
  /\bcall\s+me\s+([^\s,.!?]+)/i,
  // i'm X / i am X — must be last so more specific patterns win first.
  // Filtered downstream against NON_NAME_AFTER_IAM to reject feelings/states.
  /\bi(?:'m|\s+am)\s+([^\s,.!?]+)/i,
]

/**
 * Common state/feeling/filler words that follow "I'm…" but are NEVER names.
 * Used to filter the permissive `i'm X` pattern. Keep lowercase.
 */
const NON_NAME_AFTER_IAM = new Set([
  // emotions / states
  'sad', 'happy', 'tired', 'sleepy', 'bored', 'angry', 'lonely', 'sick',
  'fine', 'okay', 'ok', 'good', 'bad', 'great', 'awesome', 'cool',
  'hot', 'cold', 'hungry', 'thirsty', 'busy', 'free', 'done', 'ready',
  'lost', 'confused', 'scared', 'afraid', 'worried', 'nervous',
  'sorry', 'late', 'early', 'back', 'home', 'here', 'there',
  // grammar-y
  'a', 'an', 'the', 'not', 'just', 'still', 'so', 'too', 'very',
  'glad', 'sure', 'right', 'wrong',
  // contractions left after split
  "i'm", "i", 'am',
])

function isNameCandidate(raw: string, pattern: RegExp): boolean {
  if (!raw) return false
  if (raw.length > 40) return false
  // Only apply NON_NAME guard to the permissive "I'm X" pattern (last one).
  // Other patterns (my name is, call me, ผมชื่อ) are explicit enough that
  // the captured word IS the name.
  const source = pattern.source
  const isIAm = source.includes("i(?:'m|") && !source.includes('called')
  if (isIAm) {
    if (NON_NAME_AFTER_IAM.has(raw.toLowerCase())) return false
  }
  return true
}

export function extractNameIntroduction(message: string): NameIntroduction | null {
  if (!message) return null
  const trimmed = message.trim()
  for (const re of PATTERNS) {
    const m = trimmed.match(re)
    if (m && m[1]) {
      const candidate = m[1].trim()
      if (isNameCandidate(candidate, re)) {
        return { name: candidate }
      }
    }
  }
  return null
}
