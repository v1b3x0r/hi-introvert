/**
 * A5 regression: when the user message looks like a question,
 * ProtoLanguageGenerator.generateResponse() must not strip
 * memory-relevant tokens from the vocabulary pool.
 *
 * Pre-5.11 bug: generateResponse() filtered pool aggressively on
 * question intent, keeping only think/know/maybe words. Memory
 * tokens (e.g. the user's name) never surfaced.
 *
 * NOTE: 5.11 changelog does NOT mention fixing this. Expected outcome
 * of this test on 5.11 is FAIL. The test is marked .skip below; when
 * mds-core 5.12 lands with the fix, remove .skip and verify it passes.
 * See audit-5.11.md for the upstream candidate description.
 */

import { test, expect } from 'bun:test'
import { ProtoLanguageGenerator } from '@v1b3x0r/mds-core'

test.skip('generateResponse keeps memory tokens when user asks a question (pending mds-core 5.12)', () => {
  const gen = new ProtoLanguageGenerator({
    minVocabularySize: 5,
    maxPhraseLength: 4,
    emotionInfluence: 0,
    fallbackToDialogue: false,
  })

  // Simulate the call site in WorldSession: memory-boosted pool + question.
  const TARGET = 'wuttee'   // stand-in for the user's name stored in memory
  const pool = ['hi', 'name', 'you', 'i', 'mine', TARGET, 'remember', 'is']

  let seen = 0
  for (let i = 0; i < 100; i++) {
    const out = gen.generateResponse('what is my name?', {
      vocabularyPool: pool,
      emotion: { valence: 0, arousal: 0.5, dominance: 0 } as any,
      minWords: 1,
      maxWords: 4,
      allowParticles: true,
      allowEmoji: false,
      creativity: 0.5,
    })
    if (typeof out === 'string' && out.includes(TARGET)) seen++
  }

  process.stderr.write(`[a5 question-pool] TARGET seen ${seen}/100 attempts\n`)
  expect(seen).toBeGreaterThan(0)
})
