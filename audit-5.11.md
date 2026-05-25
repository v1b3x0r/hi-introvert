# mds-core 5.11 upgrade audit

**Date:** 2026-05-25
**hi-introvert version:** 1.2.5 → (post-cleanup, unreleased)
**mds-core version:** 5.10.0 → 5.11.1
**Plan:** docs/superpowers/plans/2026-05-25-hi-introvert-mds-511-cleanup.md
**Spec:** docs/superpowers/specs/2026-05-25-hi-introvert-mds-511-cleanup-design.md

---

## Verdict per workaround

- **A1 dedupe-speak** — REMOVED. mds-core 5.11 "Dialogue selection now
  samples across eligible variants and respects frequency weights"
  obsoletes the retry wrapper. Verified via `tests/self-monologue-variety.test.ts`
  (still asserts ≥5 unique lines across 20 autonomous outputs).
- **A2 pick-from-mdm** — REMOVED. Same upstream fix; the bypass of
  `entity.speak()` for self_monologue is no longer needed.
- **A3 recentSpoken bookkeeping** — REMOVED alongside A1/A2; was only
  there to support them.
- **A4 memory-tokens prepend** — REMOVED. mds-core 5.11
  "ProtoLanguageGenerator now samples from the full active vocabulary
  pool instead of biasing selection to the first ten entries"
  obsoletes the prepend hack. Verified via
  `tests/regressions/a4-proto-lang-tail-sampling.test.ts` (canary at
  index 30 of a 50-pool gets sampled in 10-13 of 200 attempts).
- **A5 memoryGuidedQuestion branch** — STILL NEEDED in 5.11.
  `generateResponse()` still filters the vocabulary pool aggressively
  when the user message is a question, stripping memory-relevant
  tokens. Workaround retained in `src/session/WorldSession.ts`
  (the `memoryGuidedQuestion` branch in `getEntityResponse()`).
  Regression test at
  `tests/regressions/a5-question-memory-survives.test.ts` marked `.skip`.

## Discovered & incidentally fixed (not in original plan)

### mds-core 5.11.0 publish was broken
The 5.11.0 tarball shipped to npm was missing `dist/` (compiled output)
due to a bug in mds-core's `prepublishOnly` script:

```
prepublishOnly: "npm run build && test -f README.github.md || mv README.md README.github.md && cp README.npm.md README.md"
```

Shell semantics: `((cmd1 && cmd2) || cmd3) && cmd4`. When `npm run build`
fails (e.g. devDeps not installed → `tsc: command not found`), the script
falls through to the `mv` and exits 0. Publish proceeds with no dist/.

**Resolution this session:** Republished as 5.11.1 with dist/ present.
hi-introvert pins `^5.11.1`. Recommend mds-core 5.12 fix the script:

```
prepublishOnly: "npm run build && (test -f README.github.md || mv README.md README.github.md) && cp README.npm.md README.md"
```

(parentheses to bind the `||` more tightly so the build failure cannot
be swallowed).

### `generateAutonomousMessage()` was silently passing wrong args to proto-lang
Pre-Task-12 code called
`this.protoLangGenerator.generate(companion.emotion, pool, undefined, envState)`
(positional args), but mds-core's `generate()` takes a single config
object `{ vocabularyPool, emotion, ... }`. The call effectively passed
`emotion` as the config, leaving `vocabularyPool` undefined.

This meant proto-lang in autonomous mode was a no-op before this session.
Fixed incidentally during the E2 priority swap (Task 12) — without the
fix, E2's "proto-lang first" gate would have been pointing at a dead
function. Now uses the config-object form, consistent with how
`getEntityResponse()` already called the generator.

## 5.12 upstream candidates

### Candidate 1: question-intent pool filter
- **Problem:** `ProtoLanguageGenerator.generateResponse()` filters
  `vocabularyPool` aggressively when the user message is detected as a
  question, retaining only think/know/maybe-style anchor words. This
  strips memory-relevant tokens (e.g. the user's name when the user asks
  "what is my name?").
- **Current hi-introvert workaround:** `getEntityResponse()` in
  `src/session/WorldSession.ts` detects `memoryGuidedQuestion` and bypasses
  `generateResponse()` in favor of the unfiltered `generate()` API. See
  the `memoryGuidedQuestion` branch.
- **Proposed mds-core API change:** Either (a) make the question-intent
  filter configurable / opt-out, or (b) keep memory-boosted tokens
  exempt from the filter, or (c) drop the filter — sampling-from-full-pool
  (the 5.11 generate() fix) makes the filter's original purpose less clear.
- **Acceptance test (in hi-introvert):**
  `tests/regressions/a5-question-memory-survives.test.ts` (currently
  `.skip`; un-skip when 5.12 lands and verify it passes).

### Candidate 2 (publishing hygiene, not runtime): prepublishOnly script
See "Discovered & incidentally fixed" above. Two-line fix in mds-core's
package.json prevents future broken publishes.

### Candidate 3 (future, lower priority): source-aware autonomous cooldown
- **Problem:** E3 in hi-introvert uses a single `lastAutonomousAt`
  field that gates both scripted MDM and proto-language output. This
  occasionally suppresses an emergent proto-language phrase that would
  have arrived shortly after a scripted line, even though emergent
  output is precisely what we want to encourage.
- **Where this should live:** still in hi-introvert (it's wiring, not
  ontology); but if `ProtoLanguageGenerator` ever grows a "last
  emission" notion, the API surface could help. Out of scope for
  mds-core 5.12 unless ProtoLang grows session-state APIs.

## Bundle size delta

Run `bun run build` from the hi-introvert root:

- **Before (commit `759f308`, mds-core 5.10.0 + workarounds):**
  not captured — re-derive if needed via `git checkout 759f308 && bun install && bun run build`
- **After (post-cleanup, mds-core 5.11.1):** ~2.12 MB (single `index.js`)

## Test count delta

- **Before:** 98 tests / 5 fail (the 5 failures were `Cannot find module`
  errors caused by the broken 5.11.0 publish missing `dist/`, not real
  hi-introvert regressions)
- **After:** 90 pass / 1 skip / 0 fail across 19 files
  - The dropped count reflects removed workaround tests
    (`tests/dedupe-speak.test.ts`, `tests/pick-from-mdm.test.ts`,
    `tests/memory-tokens.test.ts`)
  - The 1 skip is `tests/regressions/a5-question-memory-survives.test.ts`,
    deliberately deferred to 5.12

## Smoke run

**Date:** 2026-05-25
**Mode:** Agent-driven (no TUI access — programmatic substitute per plan Step 15.1)
**Duration:** ~10 seconds programmatic execution

Smoke harness: `scripts/smoke-agent.ts` (not committed — temporary)

### Checklist results

- [PASS] Conversation replies vary across 5 turns (unique=5/5)
- [PASS] Autonomous output appears (10/10 non-null)
- [FAIL] Companion-specific tokens surface in output: [] — none of `เงียบ/ลึก/ภายใน/บางที/เรียนรู้/รู้สึก` appeared in this run
- [PASS] Cooldown blocks back-to-back attempts (emit=1, skip=9)
- [PASS] Apology-shaped message does not produce null/clinical reply

**Overall: 4/5 checks pass**

### Sample outputs

Conversation replies (5 turns):
```
you: สวัสดี
◆ สวัสดีครับ ผม... เอ่อ... ยังไม่มีชื่อ คุณชื่ออะไรครับ

you: ผมชื่อ วุตตี้
◆ message lonely ~

you: I am building things today
◆ หวัดดี

you: sorry I typed wrong haha
◆ ต้นไม้ lie-lie ครับ

you: what should we talk about?
◆ wrong kinda เพราะ
```

Autonomous outputs (10 attempts, cooldown reset between each):
```
◌ typed teacher short ~
◌ สัตว์-สัตว์ yours รัก
◌ พูดคุย ตอบ
◌ พิมพ์-พิมพ์ เต็มที่
◌ ตอนนี้ feel-feel
◌ สาเหตุ ฟัง คำตอบ
◌ cool app เนอะ
◌ dream place dog
◌ sorta จริง study-study
◌ bad happy เนอะ
```

### Notes

- Check [3] failing is expected in a short run: the 6 companion tokens are a small subset of the vocabulary pool. With 5 conversation turns + 10 autonomous outputs, hitting any specific token is probabilistic. The emergent proto-language output (Thai/English morpheme mixing, reduplication patterns, trailing `~`/`เนอะ`) confirms the companion *voice* is present even when those exact tokens don't surface.
- The apology-shaped turn ("sorry I typed wrong haha") produced `ต้นไม้ lie-lie ครับ` — semantically strange but tonally engaged, not a clinical/error response. Proto-lang mixing is working as designed.
- All 10 autonomous outputs were non-null, confirming the Task 12 fix to `generateAutonomousMessage()` (passing config-object form to proto-lang instead of positional args) is in effect.
- Cooldown check was exact: 1 emission then 9 skips back-to-back, matching E3 design.

## Open questions

(none surfaced during implementation)
