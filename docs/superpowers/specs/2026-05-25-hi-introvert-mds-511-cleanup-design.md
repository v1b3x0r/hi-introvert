# Hi-Introvert × mds-core 5.11 — Mechanical Cleanup + Emergence Plumbing

**Date:** 2026-05-25
**Author:** v1b3x0r (founder) + Claude (Opus 4.7, 1M)
**Status:** Design — pending user review
**Workspace:** `/Users/v1b3_/_dev/project-world-log/hi-introvert-fix/hi-introvert/`

---

## Context

`hi-introvert` is an experimental terminal companion (v1.2.5) built on top of
`@v1b3x0r/mds-core` (an info-physics / ontology engine). The companion's
replies come from three sources: authored MDM dialogue lines, proto-language
generated from learned vocabulary, and an LLM fallback (disabled by default).

Over v1.2.x development, several **workarounds** accumulated in `hi-introvert`
to compensate for known mds-core bugs and design gaps. Many of these are
explicitly annotated in the source as "workaround for mds-core issue #N" or
"bypass mds-core's …".

On 2026-05-25, Codex published **mds-core 5.11.0 "Semantic Truth and Runtime
Hygiene"** which addresses several of these root causes upstream. The local
`hi-introvert` dependency is still pinned to `^5.7.1` (resolving to 5.10.0
via lockfile). The goal of this session is a **mechanical upgrade pass**
to take advantage of the upstream fixes while keeping the companion's
observable behavior stable, plus a small amount of **emergence plumbing**
to address a quality issue the founder spotted in field testing.

### Field-test finding

After playing with the current build, the founder observed:

> "ทำไงให้ self_monologue emerge ได้ครับ เหมือนใช้ภาษาคนละคลังกัน"

Root cause: `BASE_VOCABULARY` (~200 generic kid words like สวัสดี/ฉัน/เรียน)
and MDM `dialogue.self_monologue` (16 poetic introspective lines using words
like เงียบกว่า/ลึกกว่า/ภายใน/บางที) live in **two disjoint pools**.
`generateAutonomousMessage()` tries `pickFromMDM` first and almost always
returns an MDM line verbatim, so proto-language never surfaces the
companion-specific vocabulary. The result: the companion alternates between
poetic monologues and basic word-salad, feeling like two register-mismatched
speakers.

---

## Goals

1. **Upgrade** `@v1b3x0r/mds-core` dependency `^5.7.1` → `^5.11.0` and
   commit the resulting `bun.lock` as the version-of-truth.
2. **Remove** A-tier workarounds (A1–A5) that mds-core 5.11 makes obsolete.
   For each, write a minimal repro test to confirm the upstream fix before
   removing the workaround.
3. **Remove or fix** B-tier dead/broken code (B1–B4) unrelated to the
   upgrade.
4. **Add** E-tier emergence plumbing (E1–E3): unify the vocabulary pool so
   proto-language can speak in the companion's voice (E1), re-order
   `generateAutonomousMessage()` so proto-language gets first crack once
   the companion has learned enough words (E2), and gate autonomous output
   behind a cooldown so the companion paces its monologues instead of
   spamming them — silence is a valid outcome (E3).
5. **Document** any workarounds that 5.11 did *not* fix as upstream
   candidates for **mds-core 5.12** (`audit-5.11.md`).

## Non-Goals (out of scope for this session)

- **C-tier hardcoded mappings** — `categoryMap`, env→vocab pushes
  (`if temp > 30 push 'ร้อน'`), `getEmotionWord()`,
  `ContextAnalyzer.detectIntent/estimateEmotionHint`. These are wiring-layer
  decisions worth a separate design pass (data-driven vs. code).
- **D-tier private-API mutation** — `this.environment['config'].xxx = ...`,
  `entity.emotion = { ... }`. Likely needs new mds-core public setter API
  to address cleanly.
- **MDM content redesign** — companion essence, emotion transitions, MDM
  dialogue script, base vocabulary content. The 16-line self_monologue
  stays as-is; E1+E2 change *how* it's used, E3 changes *how often* it
  surfaces — none change *what* it says.
- **GitHub remote** for the new repo (init local only; pushing is a
  separate decision).
- **Graph semantics / semantic edges** — this is a **directional
  architecture boundary**, not just a TODO. This session operates entirely
  on *vocabulary ecology*: flat token pools, frequency, register, pacing.
  The moment hi-introvert starts parsing user statements like
  *"sun shining leadsTo energy"* into structured edges (sun → light →
  energy) and using those edges to compose phrases, it crosses into a
  different architectural mode — relation-based emergence rather than
  bag-of-words emergence. That mode is real and worth pursuing, but it
  belongs with DreamFlow DSL territory and requires its own design. The
  boundary is drawn here intentionally so this session ships before that
  rabbit hole opens.

---

## Patch Inventory

### A-tier — mds-core 5.11 workarounds (verify-then-remove)

| ID | Location | Bug it patches | 5.11 changelog evidence | Predicted |
|----|----------|----------------|-------------------------|-----------|
| **A1** | `src/utils/dedupe-speak.ts` (full file) | `entity.speak()` returns the same dialogue line repeatedly | "Dialogue selection now samples across eligible variants and respects `frequency` weights (`rare` < `medium` < `common`)." | ✅ remove |
| **A2** | `src/utils/pick-from-mdm.ts` (full file) | `entity.speak()` deterministically picks the first matching language line (mds issue #10) | Same as A1 | ✅ remove |
| **A3** | `WorldSession.recentSpoken` field (L105) + `speakDedup()` (L120-126) + all `speakDedup` call sites + `pickFromMDM` import/call (L1224-1231) | Bookkeeping for A1/A2 | Dead when A1+A2 removed | ✅ remove |
| **A4** | `src/utils/memory-tokens.ts` + `boostedTokensFromMemories` usage in `getEntityResponse` (L1040-1062) | `ProtoLanguageGenerator.generate()` samples only the first 10 items of the vocabulary pool, so trailing items never get picked | "`ProtoLanguageGenerator` now samples from the full active vocabulary pool instead of biasing selection to the first ten entries." + "Emotion-biased proto-language ordering now preserves tail vocabulary instead of truncating the pool." | ✅ remove |
| **A5** | `memoryGuidedQuestion` branch in `getEntityResponse` (L953-961 + L1064-1091) | `generateResponse()` filters the pool aggressively when intent is `question`, stripping the memory boost | ❌ not in changelog | ⚠️ keep + flag as **5.12 candidate** |

### B-tier — dead / broken code (independent of mds-core)

| ID | Location | Issue | Action |
|----|----------|-------|--------|
| **B1** | `WorldSession.getEntityInfo()` at L1489-1492 | Duplicate method; references `this.entity` which does not exist on the class | Delete (real `getEntityInfo` is at L747-749) |
| **B2** | `WorldSession.spawnFriend()` L1143-1200 | Uses `this.primaryEntity.entity` four times; `primaryEntity` does not exist on the class (only `companionEntity` and `impersonatedEntity`). Method throws on every call. | Fix: rename `primaryEntity` → `companionEntity`; do not delete (LLM-spawn is a real feature) |
| **B3** | `WorldSession.enhanceProtoLanguageWithCrystallization()` L1580-1593 | Defined but never called | Delete |
| **B4** | `silentMode` field (L102, L258-269) + `debug()` helper + `silentMode` plumbing through `spawnFriend` and `initializeCompanionSkills` | mds-core 5.11 introduces `World({ silent: true })` and `World({ debug: false })` for startup diagnostics — duplicate concern for the **construction-time** diagnostic path only | Hybrid: pass `silent: true` to `World()` at construction so mds-core startup logs are suppressed. **Keep local `silentMode` field** for `debug()` helper because callers (e.g. `setSilentMode()` from TUI) toggle at runtime; `World({ silent })` is constructor-only in 5.11 (verify at implementation time). The local field is now the only consumer of the runtime toggle; the construction path delegates to mds-core. |

### E-tier — emergence plumbing (new code)

| ID | What | Why |
|----|------|-----|
| **E1** | New `src/utils/mdm-tokens.ts` exporting `extractCompanionTokens(mdm: any, baseVocab: string[]): string[]` — walks `dialogue.intro` + `dialogue.self_monologue`, extracts all `.lang.{th,en}` strings, tokenizes via existing `tokenize()`, dedupes, **then filters out anything already in `BASE_VOCABULARY`** (set difference). Called once in `WorldSession` constructor → cached as `this.companionTokens`. Merged into `vocabularyPool` at both proto-lang call sites in `WorldSession` (`getEntityResponse` after L993, `generateAutonomousMessage` after L1249). | Unifies companion's MDM vocabulary with learned vocabulary so proto-language can generate phrases in the companion's voice instead of generic kid-language. **The set-difference is load-bearing:** without it, function words like ฉัน/ที่/ได้/เป็น would get duplicated into the pool (already in base) and out-weight the companion-specific words like เงียบ/ลึก/ภายใน/บางที, defeating the unification intent. |
| **E2** | In `generateAutonomousMessage()`: if `vocabularyTracker.getVocabularySize() >= 30`, try proto-lang **first**; on `undefined`, fall back to `entity.speak('self_monologue')` (which after 5.11 properly samples + respects frequency). Below the threshold, current MDM-first order is preserved. | Once the companion has learned enough vocabulary, prefer emergent speech over scripted MDM lines. Below threshold, MDM is the safety net so the companion isn't silent in early sessions. |
| **E3** | Autonomous-monologue cooldown gate (minimal MVP — full decay/penalty design deferred to Future Work). New field `this.lastAutonomousAt: number = 0` on `WorldSession`. At the very top of `generateAutonomousMessage()`, before any source attempt: if `Date.now() - this.lastAutonomousAt < AUTONOMOUS_COOLDOWN_MS` (default `45000`), **emit `'autonomous-skip'` with `{ reason: 'cooldown', sinceMs }`** then return `null` (= silence). After a non-null result is produced, update `this.lastAutonomousAt = Date.now()`. Constant exported from a named symbol so tests can override. **Cooldown is intentionally source-agnostic in MVP**: it gates the whole `generateAutonomousMessage()` call regardless of whether the output would have been MDM or proto-lang. This means a proto-lang phrase that would have emerged 5s after a scripted line is suppressed equally — that's a known MVP limitation, resolved by source-aware cooldown in E3-full (see Future work). | Even with E1+E2 unifying the vocabulary register, the *frequency* of autonomous output stays too high — field test showed 4 self_monologue lines emitted back-to-back, which the human reader perceives as a quote rotator regardless of vocabulary register. Cooldown + permission to be silent reframes autonomous output as **pacing, not throughput**. "Silence is emergence too." The scheduler's recursive setTimeout already handles null returns (treats them as no-emit), so this is a single-site change with no downstream wiring. The `autonomous-skip` event is the observability counterpart — without it, "silent skip" and "scheduler dead" look identical from outside; with it, the skip reason is on the event bus for any logger/inspector to consume. |

---

## Architecture Touchpoints

### Files deleted
- `src/utils/dedupe-speak.ts` (A1)
- `src/utils/pick-from-mdm.ts` (A2)
- `src/utils/memory-tokens.ts` (A4)

### Files created
- `src/utils/mdm-tokens.ts` (E1)
- `tests/regressions/a1-speak-variety.test.ts` (A1 verification)
- `tests/regressions/a2-self-monologue-variety.test.ts` (A2 verification)
- `tests/regressions/a4-proto-lang-tail-sampling.test.ts` (A4 verification)
- `tests/regressions/a5-question-memory-survives.test.ts` (A5 verification)
- `tests/emergence/companion-vocab-seeding.test.ts` (E1)
- `tests/emergence/autonomous-priority.test.ts` (E2)
- `tests/emergence/autonomous-cooldown.test.ts` (E3)
- `audit-5.11.md` (5.12 upstream candidates)
- `docs/superpowers/specs/2026-05-25-hi-introvert-mds-511-cleanup-design.md` (this file)

### Files modified
- `package.json` — bump `^5.7.1` → `^5.11.0`
- `bun.lock` — regenerated by `bun add`
- `src/session/WorldSession.ts` — A3 cleanup, B1-B4 fixes, E1+E2+E3 wiring
- (`.gitignore` already exists)

### Files untouched
- `entities/companion.mdm` — no content changes
- `entities/traveler.mdm`
- `src/vocabulary/base-vocabulary.ts`
- `src/sensors/*`
- `src/ui/*`
- `src/session/ContextAnalyzer.ts`, `MemoryPromptBuilder.ts`, `GrowthTracker.ts`
- `/mds/` — out of scope; not touched

---

## Sequence

```
Step 0  Repo init + baseline ──────────────────────── commit #1
        • git init in hi-introvert-fix/hi-introvert/
        • git add . && git commit -m "chore: import hi-introvert@1.2.5 baseline"
        • verify: git log shows one commit, working tree clean

Step 1  Dep bump + baseline check ─────────────────── commit #2
        • verify 5.11.0 available on npm registry first:
          bun pm view @v1b3x0r/mds-core versions | grep 5.11.0
          (if missing — Codex push not yet propagated — STOP and surface)
        • bun add @v1b3x0r/mds-core@^5.11.0
        • bun test → expect 59 pass (or whatever current count is)
        • bun run build → expect clean
        • commit: "chore(deps): mds-core ^5.11.0"
        ⚠️ if any baseline test fails on 5.11, STOP and audit before proceeding

Step 2  A-tier verify-then-remove ─────────────────── commit per patch
        For each Ai in [A1, A2, A4, A5]:
          (a) write tests/regressions/Ai-*.test.ts that reproduces the bug
              (the test asserts the FIXED behavior — passes only if bug is gone)
          (b) bun test that file
              ├─ pass on 5.11 → remove patch + delete helper files
              │              → bun test (full)
              │              → commit: "refactor(<area>): remove Ai workaround (fixed in 5.11)"
              └─ fail on 5.11 → restore patch (was never removed yet)
                              → mark test with `.skip` + comment referencing
                                audit-5.11.md (red CI on a known-still-broken
                                upstream bug is noise; .skip + audit = signal)
                              → record in audit-5.11.md as "still needed in 5.11"
                              → commit: "test(regressions): Ai still failing in 5.11 — skip pending mds-core 5.12"
        A3 deferred: clean up after A1+A2 outcomes known
          • If both removed: delete recentSpoken, speakDedup, all call sites
          • If either kept: keep proportionally

Step 3  B-tier dead/broken code ───────────────────── commit per fix
        • B1: delete duplicate getEntityInfo() at L1489-1492
              → bun test → commit: "fix(session): remove duplicate getEntityInfo()"
        • B2: rename primaryEntity → companionEntity in spawnFriend()
              → bun test → commit: "fix(session): repair spawnFriend reference to companionEntity"
        • B3: delete enhanceProtoLanguageWithCrystallization()
              → bun test → commit: "chore(session): drop unused crystallization helper"
        • B4: migrate silentMode → World({ silent: true })
              → bun test → commit: "refactor(session): use mds-core silent option"

Step 4  E1 vocabulary seeding ─────────────────────── commit
        • create src/utils/mdm-tokens.ts (extractDialogueTokens)
        • WorldSession constructor: cache this.companionTokens
        • merge into vocabularyPool at 2 call sites
        • create tests/emergence/companion-vocab-seeding.test.ts
          (spawn companion, gen 20 autonomous msgs with vocab=30,
           expect ≥3 distinct companion-specific tokens in proto-lang output)
        • bun test → commit: "feat(emergence): seed proto-lang pool with companion MDM tokens"

Step 5  E2 priority swap ──────────────────────────── commit
        • generateAutonomousMessage(): if vocab >= 30, try proto-lang first
        • fall back to entity.speak('self_monologue') on undefined
        • create tests/emergence/autonomous-priority.test.ts
          (assert proto-lang attempted before MDM when threshold met)
        • bun test → commit: "feat(emergence): proto-lang first in autonomous when vocab ready"

Step 6  E3 autonomous cooldown ────────────────────── commit
        • add WorldSession.lastAutonomousAt: number = 0
        • export AUTONOMOUS_COOLDOWN_MS = 45000 from WorldSession (or
          a sibling constants file — pick whichever already exists)
        • generateAutonomousMessage() top: if within cooldown window,
          emit 'autonomous-skip' with { reason: 'cooldown', sinceMs },
          then return null (silence is a valid outcome)
        • on non-null result, update lastAutonomousAt = Date.now()
        • create tests/emergence/autonomous-cooldown.test.ts:
          (1) inject fake clock + event spy, call gen twice within window
              → second returns null + autonomous-skip event fires with
                reason: 'cooldown'
          (2) advance clock past window → next call produces output again
          (3) override AUTONOMOUS_COOLDOWN_MS to 0 → no gate, used by E1/E2 tests
        • bun test → commit: "feat(emergence): autonomous-monologue cooldown gate (silence is emergence too)"

Step 7  Audit + final smoke ───────────────────────── commit
        • finalize audit-5.11.md (per-A verdicts + 5.12 candidates)
        • manual smoke run hi-introvert for 2-3 min:
            - greet, ask, teach a word, wait for self_monologue
            - watch ◌ self_monologue lines for emergent tokens
            - watch for crashes / undefined output / register mismatch
        • bun test (full suite — final green check)
        • bun run build (final bundle check)
        • commit: "docs: audit notes for mds-core 5.12 candidates"
```

---

## Verification Strategy

### Per-patch (A-tier)
Each A-patch gets a regression test in `tests/regressions/` that exposes the
*original* bug. The test passes only if mds-core 5.11 has fixed the bug
upstream. If the test passes, the workaround is removed; if it fails, the
workaround stays and we log the failure in `audit-5.11.md`.

Test idioms:
- **A1 (speak repetition):** `for (let i = 0; i < 20; i++) bag.add(entity.speak('intro')); expect(bag.size).toBeGreaterThanOrEqual(3)`
- **A2 (deterministic first-match):** same shape, category `self_monologue`
- **A4 (first-10 window):** construct pool `[w0..w49]` with target at index 30, call `protoLang.generate({ vocabularyPool, … })` 100×, expect target sampled at least once
- **A5 (question pool filter):** call `generateResponse('what is X?', { vocabularyPool: [...basicWords, 'X', 'name', 'mine'], … })`, expect `'X'` or `'name'` to appear in output across N attempts

### Per-feature (E-tier)
- **E1 unit (deterministic — primary gate):** call `extractCompanionTokens(companionMDM, BASE_VOCABULARY)` and assert the result *includes* expected companion-specific tokens (`เงียบ`, `ลึก`, `ภายใน`, `บางที`, `เรียนรู้`, `รู้สึก`) and *excludes* base-vocab function words (`ฉัน`, `ที่`, `ได้`, `เป็น`). Then, with a mocked proto-lang generator, assert the assembled `vocabularyPool` at the call site contains all entries from `companionTokens`. Pool composition is deterministic, so this gates correctness without sampling noise.
- **E1 integration (stochastic — observational):** spawn companion with vocabulary size 30, call `generateAutonomousMessage` 100 times. Tokenize all outputs. Assert that across the 100 outputs, the *group* of companion-specific tokens is observed at least once total — not per-token, not per-message. 100 attempts × ~3 tokens per output × non-zero probability gives comfortable statistical margin; if this assertion fails repeatedly, E1 wiring is broken, not flaky.
- **E2:** spy on `protoLangGenerator.generate` and `entity.speak`. With vocab ≥ 30, assert `generate` is called before `speak` in `generateAutonomousMessage`. Deterministic — no sampling.
- **E3:** inject a fake clock (`Date.now` mock). (1) Two consecutive calls within `AUTONOMOUS_COOLDOWN_MS` → second returns `null` **and an `autonomous-skip` event fires with `reason: 'cooldown'`**. (2) Advance clock past window → next call returns non-null again. (3) Set cooldown to `0` → behaves as if E3 absent (used by E1/E2 tests so they're independent of E3). All deterministic.

### System-level
- `bun test` full suite must remain 100% pass at every commit
- `bun run build` must succeed at every commit (bundle size delta noted but not gated)
- Manual smoke run before final commit (founder operates, AI observes output)

### Smoke checklist (manual, Step 7)
- [ ] companion greets and replies vary across 5+ turns
- [ ] `◌` self_monologue line appears within 60s of idle
- [ ] at least one self_monologue contains a companion-specific token
      (เงียบ / ลึก / เรียน / บางที / ภายใน) without quoting full MDM line
- [ ] **autonomous monologue lines no longer arrive back-to-back** within
      the cooldown window (~45s); some idle ticks produce silence — that's
      a pass, not a bug
- [ ] **preserve accidental emotional mirroring** — if user types an
      apology-shaped message ("sorry I'm wrong typing haha"), companion's
      response should not feel mechanically clinical; if a refactor breaks
      this, stop and investigate (this is an emergent quality worth
      protecting, not a bug to fix)
- [ ] `/status`, `/growth`, `/lexicon` commands work
- [ ] no thrown errors, no `undefined` *user-facing* responses, no register
      mismatch between turns

---

## Rollback

- Every step ends with a green-test commit. To undo a step:
  `git reset --hard <previous-commit>` from inside
  `hi-introvert-fix/hi-introvert/`.
- `/mds/` is not touched in this session; its working tree changes
  (`.DS_Store`, `README.md`, `AGENTS.md`, `README.github.md`) are pre-existing
  and out of scope.
- No `--no-verify`, no `--force`, no skipped tests.
- If `bun test` fails unexpectedly at any step, stop and escalate to the
  founder before continuing.
- If 5.11 turns out to introduce regressions (Step 1 baseline check fails),
  the entire session reverts to commit #1 and we escalate.

---

## Audit Output — `audit-5.11.md`

Lives at `hi-introvert/audit-5.11.md`, committed in Step 6. Format:

```markdown
# mds-core 5.11 upgrade audit

## Verdict per workaround

- A1 dedupe-speak: <fixed | still-needed>
  evidence: tests/regressions/a1-speak-variety.test.ts <pass | fail>
- A2 pick-from-mdm: …
- A4 memory-tokens: …
- A5 question-memory-survives: …

## 5.12 upstream candidates

For each "still-needed" A-patch, plus any C/D-tier issue surfaced during
this session that should move upstream:

### Candidate: <name>
- **Problem:**
- **Current hi-introvert workaround:** <file>:<line>
- **Proposed mds-core API change:**
- **Acceptance test (in hi-introvert):** <test file path>
```

---

## External feedback applied

Spec went through two rounds of cross-LLM calibration (GPT) before
finalization. First round surfaced four issues on the E1/E2 design; second
round surfaced a higher-tier issue ("monologue dominance") after the
founder field-tested the current build and shared session logs with GPT.
All addressed inline.

### Round 1 — E1/E2 hygiene

1. **E1 token noise** — Without filtering, MDM tokens like ฉัน/ที่/ได้/เป็น
   would duplicate into the pool (already in `BASE_VOCABULARY`) and dominate
   sampling over the companion-specific words E1 is meant to surface.
   *Fix:* `extractCompanionTokens` now takes set difference vs.
   `BASE_VOCABULARY` (see E1 row, Patch Inventory).
2. **E1 test flakiness** — A single threshold over 20 stochastic samples is
   brittle. *Fix:* primary gate is now a deterministic unit test on pool
   composition; the integration test is observational with 100 attempts and
   group-level assertion (see E1 entries, Verification Strategy).
3. **E2 threshold = 30 is MVP, not endgame** — Better long-term signal is a
   readiness *score* (vocab size + recent learning rate + emotional
   stability + repetition penalty). *Fix:* documented as future work below;
   threshold = 30 stays for this session.
4. **B4 silentMode is dual-natured** — `World({ silent })` covers startup
   diagnostics (construction-time) but TUI callers toggle silence at
   runtime. *Fix:* hybrid — delegate construction path to mds-core, keep
   local field for runtime toggle (see B4 row, Patch Inventory).

### Round 2 — monologue dominance (from field-test log)

5. **Vocabulary unification is necessary but not sufficient.** Field log
   showed the companion emitting 4 self_monologue lines back-to-back over a
   short window. Even with E1+E2 unifying the vocab register, the perceived
   output stays "quote rotator"-like because the *frequency* of authored
   monologue stays too high. The fix isn't more sampling — it's pacing.
   *Fix:* added **E3 cooldown gate** (minimal MVP — 45s window, silence is
   a valid outcome). Full design — repetition hashing, decay, probabilistic
   MDM-bias when last 2 outputs were scripted — documented in Future work.
   Rationale baked into spec: **"silence is emergence too."** A companion
   that occasionally outputs nothing during an idle tick reads as having
   internal pacing; a companion that *must* emit on every tick reads as
   chatbot.

### Round 3 — pre-implementation polish

6. **E3 cooldown granularity is intentionally coarse.** A single
   `lastAutonomousAt` field gates both scripted and proto-language output.
   Known side effect: a proto-language phrase that would have emerged 5s
   after a scripted line gets suppressed equally. This is accepted as MVP
   discipline — going source-aware (separate `lastScripted` /
   `lastProto` timestamps with asymmetric thresholds) opens the door to
   the full E3-full state machine and breaks the "minimal" framing.
   *Decision:* keep single field; flag as known limitation in Future work
   under E3-full.
7. **Null-return needs observability or it becomes a debug nightmare.**
   "Silence" and "scheduler dead" look identical from outside the call.
   *Fix:* `'autonomous-skip'` event with `{ reason, sinceMs }` payload
   emitted whenever cooldown blocks. Pattern matches existing
   `EventEmitter` usage in `WorldSession` (sync-moment, longing, lunar,
   etc.). E3 test asserts the event fires.
8. **Graph semantics is a boundary, not a TODO.** Earlier draft listed
   "semantic edges" as future work alongside other items, implying same
   axis. *Fix:* promoted to an explicit **directional architecture
   boundary** in Non-Goals — vocabulary ecology vs. relation-based
   emergence are different architectural modes, and naming the boundary
   here is what keeps this session from drifting into DreamFlow DSL
   territory mid-implementation.

### Discovered (preserve, don't break)

The field-test log surfaced two emergent behaviors worth protecting:

- **Accidental emotional mirroring** — when user typed "sorry I'm wrong
  typing haha", companion replied "จะ... พยายามมากขึ้น". The companion does
  not actually parse the apology semantics, but the contextual response
  reads as emotionally attuned. Added to smoke checklist as protect-not-fix.
- **World-mechanics teaching** — when user typed
  *"when sun ☀️ is shining always leadto life gain energy"*, they were
  feeding the companion ontological relations (sun → light → energy →
  alive), not just vocabulary. Today's architecture stores these as flat
  memory tokens. A future direction is to capture them as semantic edges so
  the companion can compose phrases like *"today hot, maybe sun give too
  much energy"* — emergence with world-model, not just word-bag. Logged in
  Future work.

## Future work (not this session)

The architectural reframe surfacing through these calibration rounds:
hi-introvert is shifting from **"toy chatbot"** to **"low-resolution
cognitive ecology"**. Future direction is not "more clever" — it's
**pacing / silence / memory pressure / repetition decay / temporal mood**.
The items below are sequenced along that axis.

- **E3-full — autonomous output as pacing system** — extend the cooldown
  MVP to the full design:
  - **source-aware cooldown** — split `lastAutonomousAt` into
    `lastScriptedMonologueAt` + `lastProtoLanguageAt` with asymmetric
    thresholds (heavier cooldown on scripted output, lighter on proto-lang
    so emergent phrases aren't suppressed unfairly when they happen to
    arrive shortly after a scripted line)
  - `recentAutonomousCount` with time-window decay
  - `recentMonologueHashes` ring buffer → exponential repetition penalty
  - probabilistic bias toward proto-language when last K outputs were
    scripted MDM
  - silence frequency as a tunable, not just a side effect
  - `autonomous-skip` event reasons expanded (`'repetition'`,
    `'pressure-saturated'`, etc.)
  Owner: next emergence-tuning session.
- **E2 readiness score** — replace single `vocab >= 30` threshold with a
  composite readiness signal. Inputs to consider: vocabulary size, learning
  rate over recent N turns, emotional stability (low arousal variance),
  repetition penalty (down-weight if last K self_monologue outputs were
  similar). Owner: same session as E3-full (the two interlock).
- **Semantic edges from user statements** — when user feeds ontological
  relations like *"sun shining leadsTo energy"*, parse and store as edges
  in a small graph attached to the companion, not just flat tokens. Enables
  proto-language to compose statements that read as world-understanding,
  not just word-mixing. Touches DreamFlow DSL territory.
- **C-tier hardcoded mapping cleanup** — `categoryMap`, env→vocab pushes,
  `getEmotionWord`, `ContextAnalyzer.detectIntent/estimateEmotionHint`.
  Should be data-driven (MDM-resident or sidecar config). Owner: future
  session.
- **D-tier private-API mutation** — likely needs new public setter API in
  mds-core (e.g. `world.environment.setBase(...)`, `entity.setEmotion(...)`).
  Owner: mds-core 5.12+.

## Open questions

None known at design time. If new ones surface during implementation, they
get logged in `audit-5.11.md` under "open questions" rather than blocking
the session.

---

## Plan handoff

After this design is approved and committed, transition to
`superpowers:writing-plans` to produce the detailed step-by-step
implementation plan with per-step verification gates.
