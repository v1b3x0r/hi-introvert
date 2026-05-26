# companion.mdm — minimal English seed (showcase build)

**Date:** 2026-05-26
**Status:** Approved — ready for implementation
**Author:** v1b3 + Claude (pair)

---

## Goal

Replace the 244-line bilingual `entities/companion.mdm` with a ~26-line English-only seed that demonstrates how much of the companion's personality, language, and behaviour emerges from the mds-core engine — not from authored configuration.

The shorter the MDM, the louder the engine speaks for itself. This becomes the default companion shipped on npm so global users can `npx hi-introvert` and watch a near-blank slate grow.

## Constraints

- **English-only.** No Thai mixing in the default companion. Thai users can swap to the preserved Thai variant.
- **Language-agnostic newborn voice.** Strip cultural framing ("Thai kid"). Make the seed read like a mind that hasn't placed itself anywhere yet.
- **Voice: sparse poetic.** Fragments of consciousness, not paragraphs.
- **~26 lines.** Aggressive trim, but keep a 3-line `intro` array as a cold-start safety net so the first ~20 turns aren't pure "..." silence.
- **Preserve history.** Move (not delete) the current Thai version.

## Final MDM content

```json
{
  "$schema": "https://mds.v1b3.dev/schema/v5.7",
  "material": "entity.companion",

  "essence": {
    "en": "a small mind learning to speak. remembers everything you say. has no words of its own — yet."
  },

  "languageProfile": {
    "native": "en",
    "weights": { "en": 1.0 }
  },

  "emotion": {
    "base_state": "neutral",
    "transitions": [
      { "trigger": "user.praise",    "to": "happy",    "intensity": 0.5 },
      { "trigger": "user.criticism", "to": "sad",      "intensity": 0.4 },
      { "trigger": "user.question",  "to": "thinking", "intensity": 0.3 },
      { "trigger": "user.greeting",  "to": "curious",  "intensity": 0.3 }
    ]
  },

  "dialogue": {
    "intro": [
      { "lang": { "en": "..." } },
      { "lang": { "en": "hi." } },
      { "lang": { "en": "who are you?" } }
    ]
  }
}
```

## What is removed and why each removal is safe

| Field removed | Why it's safe to drop |
|---|---|
| `physics`, `manifestation` | Read only by visual renderers; hi-introvert is a TUI app. |
| `memory` schema block | Decorative — actual memory config comes from `MemoryBuffer` constructor inside mds-core. |
| `cognition`, `world_mind` | No code path reads these fields. Documentation-only. |
| `relationships` initial values | Cognitive links are created at runtime via `companion.connectTo(traveler, ...)` in `WorldSession.setupCognitiveLinks`. |
| `behavior.onIdle / onProximity / ...` | Autonomous behaviour is driven by `scheduleAutonomous` + cooldown gate (E3) in code, not MDM rules. |
| `skills.learnable` | Skills are initialized from code in `initializeCompanionSkills()` (cnv 0.3, cre 0.5, emp 0.4, lrn 0.6). MDM was decorative. |
| `dialogue.self_monologue` (8 × 2 langs) | Removing this forces autonomous emissions through proto-language — exactly the emergence showcase. The `tryProtoLang` fallback in `generateAutonomousMessage` handles the empty case. |
| `dialogue.happy / sad / curious / tired / ...` (any emotion-keyed entries) | Removing them forces emotion-fallback in `getEntityResponse` to fall through to proto-lang. |
| `notes` array (12 lines of inline docs) | Documentation belongs in README and this spec, not in runtime config. |

## What is kept and why

| Field kept | Reason |
|---|---|
| `essence.en` | Read by `WorldSession.spawnEntity` and stored as `subject: 'self'` memory at spawn. Used by `MemoryPromptBuilder` for LLM prompts. |
| `languageProfile` | mds-core reads `native`/`weights` for language selection in proto-lang and dialogue. |
| `emotion.base_state` + 4 `transitions` | mds-core's `checkEmotionTriggers()` (called from `handleUserMessage`) needs transitions to react to user signals. Without them, the companion's emotion stays neutral forever. |
| `dialogue.intro` (3 lines) | Cold-start safety net. Cycles for the first ~20 turns until vocab passes the 20-word proto-lang threshold. Also used by `WorldSession.getGreeting()` for returning visitors. |

## Cold-start UX timeline

| Vocab range | Behaviour |
|---|---|
| 0 – 19 (turns 1-5ish) | Companion cycles through 3 intro lines. Conversations feel quiet but intentional. |
| 20 – 29 | Proto-language activates for user replies. MDM is the safety net for autonomous. |
| 30+ (`PROTO_LANG_PRIORITY_THRESHOLD`) | Proto-first in both user replies and autonomous monologues. Full emergence. |

Identity capture (the `[identity] NAME` system message) works at every stage — the regex patterns in `name-detect.ts` already cover English (`I'm X` / `call me X` / `my name is X` / `my name X`).

## File operations

1. `git mv entities/companion.mdm entities/companion-th.mdm` — preserves git history of the 244-line version under a new path. Thai users (and curious explorers) can manually swap by renaming back, or set up an environment switch later.
2. Create new `entities/companion.mdm` with the JSON above.

## Test impact assessment

Tests that touch companion.mdm content and may need updating:

- `tests/utils/mdm-tokens.test.ts` — `extractCompanionTokens` tests. The fixtures use synthetic MDM, not the real file, so this should be unaffected. Verify.
- `tests/regressions/name-recall-end-to-end.test.ts` — uses real WorldSession which loads `companion.mdm`. The 3 tests should still pass: identity memory still stores, retrieval still works, proto-lang still surfaces names. The test that pumps vocab manually still passes because vocab building bypasses the MDM seed.
- `tests/maturity.test.ts` — uses dominance + diversity. Dominance defaults to 0.5 via mds-core neutral state; diversity is computed from memory subjects which still accumulate. Should pass.
- `tests/skills-survive-load.test.ts` — skills are seeded from code, independent of MDM. Should pass.
- `tests/emergence/*.test.ts` — autonomous priority/cooldown tests use the real MDM. The proto-first priority threshold still holds since vocab grows from interaction, not MDM. The "vocab seeding" test asserts companion tokens appear in autonomous output — since dialogue is now smaller, `extractCompanionTokens` returns fewer tokens. This test may need adjustment if it asserts a minimum token count, or it might just observe different tokens.

Strategy: run the full suite after the swap and fix only what breaks. No preemptive test rewrites.

## Verification plan

After implementation:

1. `bun test` — full suite green (115 → likely still 115, possibly minor fixes).
2. `bun run scripts/smoke-name-recall.ts` — non-interactive driver. Expect:
   - Intro lines cycle for early turns (vocab building)
   - `[identity] wutty` captured (smoke logs this as part of handleUserMessage event flow if we surface it)
   - "do you remember me?" surfaces "wutty" in ≥ 3 of 5 attempts
   - No crashes (defensive pool filter holds)
3. Live `bun run src/index.tsx` — manual founder smoke. Expect quiet English-only cold start, then proto-lang emergence after ~5-10 turns of vocabulary input.

## What's deferred (out of scope this round)

- **`traveler.mdm`** — left as-is (83 lines, Thai). Traveler is impersonated by the user; its dialogue rarely surfaces. If global launch reveals issues, address in a follow-up.
- **Env-switch mechanism** for `LANG=th` swap. Power users can manually rename `companion-th.mdm` ↔ `companion.mdm` for now. Add automated switch if demand materializes.
- **README update.** Will be done as part of the implementation step, but is a documentation chore — not a design question.
- **Version bump to 1.2.7 + npm publish.** Happens after manual verification confirms the new default feels right. Separate operation.

## Success criteria

- New `entities/companion.mdm` is ≤ 30 lines.
- Full test suite passes.
- Smoke script shows proto-lang surfaces user's name reliably.
- Live cold-start feels quiet but intentional, not broken.
- Founder approves the live feel before npm publish.
