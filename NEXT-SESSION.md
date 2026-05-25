# hi-introvert — next session resume

**Last touched:** 2026-05-25 (late evening session)
**Branch:** `main` (local only, no GitHub remote)
**HEAD:** `47b1147 chore: address final-review polish items`
**Tests:** 90 pass / 1 skip / 0 fail · **Bundle:** 2.12 MB
**Status:** *"companion is alive in a cute way"* — emergence working, name-recall broken
**Vibe:** side-project, after-hours, treat with humor

---

## If you're an agent picking this up

Read in this order (≈10 minutes total):

1. **This file** — TL;DR + known bugs + mission options (you're here)
2. **`audit-5.11.md`** — what last session changed + verdict per workaround + 5.12 candidates
3. **`docs/superpowers/specs/2026-05-25-hi-introvert-mds-511-cleanup-design.md`** — design rationale, especially the "Future Work" section and "directional architecture boundary" in Non-Goals
4. **`docs/superpowers/plans/2026-05-25-hi-introvert-mds-511-cleanup.md`** — only if you need to know HOW something got built

Don't dive into code before audit + spec — they explain what's deliberate vs. accidental, and which "code smells" are actually intentional MVP scope.

---

## What's working — don't break

Last session shipped **A-tier cleanup + B-tier fixes + E-tier emergence**. Live observation confirmed:

- **E1 vocab seeding** — companion-specific tokens from `companion.mdm` (e.g. `เลย`, `จ้ะ`, `เนอะ`, `บางที`) surface in proto-lang output
- **E2 priority swap** — proto-lang fires first once vocab ≥ `PROTO_LANG_PRIORITY_THRESHOLD` (= 30); MDM as safety net below
- **E3 cooldown** — 45s gate between autonomous emissions; `autonomous-skip` event fires for observability; silence is a valid outcome
- **Mixed Thai+English register coherent** — `อบอุ่น there nervous`, `เลย english จ้ะ` (companion accidentally complains about English — emergent meta-commentary 😅)
- **Reduplication + stretched words happening** — `ฉลาดดด`, `meet-meet`, `hurttt`, `posttt`
- **Companion learns user typos as words** — `slilence` (user typo) became a word the companion uses

---

## Known bugs from live testing (2026-05-25 evening)

### 🐛 Bug 1 — Name recall doesn't fire (HIGH priority — founder's #1 wish for next session)

**Symptom:**
```
you: ผมชื่อ Wutty
... 50+ conversations later ...
you: did you remember my name ?
◆ companion: problem brighter เลย     # not the name
```

**Diagnosis (informed guess — verify before fixing):**
- `src/session/ContextAnalyzer.ts:findRelevantMemories()` scores by keyword overlap between the user's keywords and `JSON.stringify(memory.content)`.
- The question "did you remember my name?" extracts keywords `did/you/remember/name`. The memory storing the name has content like `{intent: 'statement', message: 'ผมชื่อ Wutty'}` — *no overlap with "name"*. Score = 0.
- Score = 0 → `relevantMemories` empty → `memoryGuidedQuestion` branch (`context.intent === 'question' && context.relevantMemories.length > 0`) never fires.
- Falls through to generic proto-lang sampling from full pool. "Wutty" *might* surface if the pool is small enough, but with 613-word vocab it's a needle in a haystack.

**Why A5 workaround didn't help:** A5 covers the *pool-filter* bug (when memoryGuidedQuestion DOES fire, generateResponse strips memory tokens). It doesn't help when the branch never fires in the first place.

**Where to investigate:**
- `src/session/ContextAnalyzer.ts` — `findRelevantMemories()` + `detectIntent()`
- How `WorldSession.handleUserMessage` stores name-introductions (subject/content shape)
- `companion.memory.recall()` API in mds-core — does it support semantic search yet, or only by-subject?

**Possible fixes (pick one in next session):**
- (a) **Semantic similarity scoring** — replace keyword overlap with embedding similarity (mds-core 5.11 has `Similarity Provider` / `EntitySimilarityAdapter` — see CHANGELOG)
- (b) **Explicit name-question detection** — if intent is question AND keywords include "name/ชื่อ/เรียก", search memories tagged as identity/self
- (c) **Better memory tagging at write time** — when `handleUserMessage` detects "ผมชื่อ X" / "my name is X", store with `subject: 'user_name'` (not just `subject: 'traveler'`) so retrieval can target it

**Tests to add for fix:**
- New: `tests/regressions/name-recall-end-to-end.test.ts` — drives the actual conversation
- Existing: `tests/regressions/a5-question-memory-survives.test.ts` (currently `.skip`) — un-skip if 5.12 lands the upstream fix
- Existing: `tests/name-recall.test.ts` — already-weakened assertions; tighten once recall works

### 🐛 Bug 2 — Maturity stuck at 0%

**Symptom:** `/growth` stats show `Maturity: 0%` even after 57 conversations.

**Where to investigate:** `src/session/GrowthTracker.ts` — calculation formula or update cadence.

### 🐛 Bug 3 — Skills don't tick

**Symptom:** Skill levels `cnv30 cre50 emp40 lrn60` never change across 57 conversations.

**Where to investigate:**
- `companion.mdm` declares `skills.learnable` with triggers (`new_word_learned`, `user.emotion_detected`, `conversation_milestone`)
- mds-core 5.11.1 `companion.skills` API — does it tick automatically on world.tick, or need explicit calls?
- `WorldSession.handleUserMessage` doesn't seem to fire the trigger events for skills

### ⚠️ Observation 4 — env shows extreme values

`env 36°C · 99% humid · Patchy rain nearby` — that's possible (CPU under load + humid weather), but worth sanity-checking the OS→env mapping if it stays pinned.

---

## Next session — mission options

Pick one or combine. Founder leans toward **A** for next session.

### Option A — Name recall + episodic memory probe (RECOMMENDED, founder's wish)

- Drive the name-recall fix end-to-end: write a failing test → diagnose → choose between (a)/(b)/(c) above → fix → verify
- While inside `companion.memory.recall()` and friends, **exercise MDS's episodic memory** to verify it does what the design promises (the founder explicitly wants this audit)
- Outcome: companion answers "what's my name?" + we have a real audit of episodic recall in mds-core 5.11.1

### Option B — C-tier hardcoded mapping cleanup

Per the spec's "Future Work" section. Move data-driven:
- `WorldSession.categoryMap` (intent → MDM category — most map to categories that don't exist in v6.3 MDM)
- env→vocab pushes at 2 sites (`if tempC > 30 push 'ร้อน'` etc.)
- `getEmotionWord` valence→word table
- `ContextAnalyzer.detectIntent` regex + `estimateEmotionHint` table

Bug 1 (name recall) lives inside this scope — Option B would naturally include it.

### Option C — Skill / Maturity investigation (Bugs 2 + 3)

Smaller scope, mostly diagnostic + one fix or one removal. Good if the founder is short on time.

### Option D — E3-full

The richer cooldown design from the original spec (decay, repetition hashes, source-aware split). Not blocking, but interesting design work.

---

## Quick-start commands

```bash
cd /Users/v1b3_/_dev/project-world-log/hi-introvert-fix/hi-introvert
git log --oneline | head -5             # confirm HEAD
bun test 2>&1 | tail -5                 # confirm green baseline
cat audit-5.11.md                       # load full context

# Run companion interactively:
bun run dev
# or
npx hi-introvert     # NOTE: this fetches the published version (1.2.5),
                     # not your local edits. Use `bun run dev` for local.
```

---

## Optional housekeeping (anytime, no rush)

- **Deprecate broken mds-core 5.11.0 on npm** (5.11.1 is the working one):
  ```bash
  npm deprecate '@v1b3x0r/mds-core@5.11.0' 'broken publish — missing dist/. Use 5.11.1 or later.'
  ```
- **Publish hi-introvert 1.3.0** — only after 2-3 days of self-testing E1/E2/E3 to be sure the cooldown / proto-first behavior feels right
- **Push to GitHub** — remote not set up yet. Decision deferred.
- **Bump version in package.json** — still `1.2.5`; should be `1.3.0` next publish (E1/E2/E3 = new features, minor bump)

---

## Memorable quotes from the test session

> `companion: เลย english จ้ะ`
> (in reply to "How about you environment" — accidentally complaining about English)

> `you: did you remember my name?`
> `◆ companion: problem brighter เลย`
> (zen poetry by accident — the bug we're fixing)

> `◌ แม่ slilence`
> (companion learned the user's typo "slilence" as a real word — emergent vocabulary acquisition working as designed)

---

*Generated 2026-05-25. If this file is older than 2 weeks and HEAD has moved, regenerate.*
