/**
 * A4 regression: ProtoLanguageGenerator must sample from the full
 * vocabulary pool, not just the first 10 entries.
 *
 * The bug it patches: pre-5.11, generate() biased sampling toward
 * pool[0..9], so tokens placed later never got selected.
 *
 * This test passes once mds-core 5.11's "full active vocabulary pool"
 * fix lands.
 */

import { test, expect } from 'bun:test'
import { ProtoLanguageGenerator } from '@v1b3x0r/mds-core'

test('proto-lang samples tokens placed beyond index 10', () => {
  const gen = new ProtoLanguageGenerator({
    minVocabularySize: 5,
    maxPhraseLength: 4,
    emotionInfluence: 0,
    fallbackToDialogue: false,
  })

  // Build a 50-token pool with a uniquely identifiable target at index 30.
  // The other 49 slots are filler tokens.
  const TARGET = '__a4_canary_token__'
  const pool: string[] = []
  for (let i = 0; i < 50; i++) {
    pool.push(i === 30 ? TARGET : `filler${i}`)
  }

  // Sample many times. If the bug were still present, TARGET (index 30)
  // would never appear. With the 5.11 fix, it should appear at least once
  // in 200 attempts with comfortable margin.
  let seen = 0
  for (let i = 0; i < 200; i++) {
    const out = (gen as any).generate({
      vocabularyPool: pool,
      emotion: undefined,
      minWords: 2,
      maxWords: 4,
      allowParticles: false,
      allowEmoji: false,
      creativity: 0.5,
    })
    if (typeof out === 'string' && out.includes(TARGET)) seen++
  }

  process.stderr.write(`[a4 tail-sampling] canary seen ${seen}/200 attempts\n`)
  expect(seen).toBeGreaterThan(0)
})
