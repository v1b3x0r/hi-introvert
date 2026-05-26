# companion.mdm minimal English seed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 244-line bilingual `entities/companion.mdm` with a ~26-line English-only minimal seed that showcases mds-core emergence, while preserving the Thai version as `companion-th.mdm`.

**Architecture:** Rename current file (git mv) → write new minimal file → verify via smoke script + full test suite → fix any test that asserted Thai-specific MDM content. No code changes outside MDM swap unless tests break.

**Tech Stack:** JSON (MDM file), bun test (verification), git (history preservation)

**Spec:** `docs/superpowers/specs/2026-05-26-companion-en-minimal-design.md`

---

## Task 1: Snapshot baseline state

**Files:** (no edits — diagnostic only)

- [ ] **Step 1: Confirm working tree clean**

Run: `git status --short`
Expected: empty output (no uncommitted changes from prior session) OR known in-progress changes the user has acknowledged.

If unexpected dirty state, STOP and ask user.

- [ ] **Step 2: Capture baseline test count**

Run: `bun test 2>&1 | tail -4`
Expected: `115 pass / 1 skip / 0 fail` (current baseline after recent fixes).
Record actual numbers in scratch; they're the regression reference for Task 4.

- [ ] **Step 3: Capture baseline smoke output**

Run: `bun run scripts/smoke-name-recall.ts 2>&1 | tail -20`
Expected: 5 turns of "do you remember me?", "wutty" appears in ≥ 2 of them, no ERROR lines.
Record sample for comparison.

## Task 2: Preserve Thai version under new path

**Files:**
- Rename: `entities/companion.mdm` → `entities/companion-th.mdm`

- [ ] **Step 1: Rename via git mv (preserves history)**

Run: `git mv entities/companion.mdm entities/companion-th.mdm`
Expected: silent success, `git status` shows rename:

```
R  entities/companion.mdm -> entities/companion-th.mdm
```

- [ ] **Step 2: Verify history preserved**

Run: `git log --follow --oneline entities/companion-th.mdm | head -5`
Expected: shows multiple commits including original creation. If only 1 line shown, history was lost — STOP, investigate.

## Task 3: Write new minimal English companion.mdm

**Files:**
- Create: `entities/companion.mdm`

- [ ] **Step 1: Write the new file**

File `entities/companion.mdm`:

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

- [ ] **Step 2: Verify line count + JSON validity**

Run: `wc -l entities/companion.mdm && cat entities/companion.mdm | python3 -m json.tool > /dev/null && echo "valid JSON"`
Expected: `26 entities/companion.mdm` (give or take ±2) and `valid JSON`.

If invalid JSON, fix the file (likely a missing comma) before continuing.

## Task 4: Run full test suite, observe what breaks

**Files:** (verification — read-only)

- [ ] **Step 1: Run full bun test**

Run: `bun test 2>&1 | tail -10`

Expected outcomes (in order of likelihood):

1. **All green** (`115 pass / 1 skip / 0 fail`): proceed to Task 5.
2. **Some failures** — most likely candidates:
   - `tests/emergence/vocab-seeding.test.ts` — asserts companion-specific tokens appear in autonomous output. With smaller MDM the token set is smaller. May still pass since it only requires ≥1 token, but verify.
   - Any test that hardcoded a Thai phrase from old companion.mdm dialogue. Search to confirm.

- [ ] **Step 2: If failures occur, capture exact failing test names**

Run: `bun test 2>&1 | grep "^(fail)" | head -10`
Record the list. Proceed to Task 4b only if list is non-empty.

## Task 4b: (Conditional) Fix broken tests

**Skip this task if Task 4 was all green.**

**Files:** (depends on what broke)

- [ ] **Step 1: For each failing test, read the assertion**

Open the failing test file and identify what it asserted. Common patterns:

| Failure mode | Fix strategy |
|---|---|
| Test asserts `>= N tokens` and now has < N | Lower the threshold to match new MDM token count |
| Test asserts specific Thai phrase appears | Replace with `expect(...).toBeTruthy()` or check for any string output |
| Test asserts a removed dialogue category exists | Remove the assertion — the engine handles missing category by falling through |

- [ ] **Step 2: Apply minimal fix**

Edit the test to match the new MDM. Do NOT change production code to make a stale test pass.

- [ ] **Step 3: Re-run only the fixed tests**

Run: `bun test <path/to/fixed/test.ts>`
Expected: PASS

- [ ] **Step 4: Re-run full suite**

Run: `bun test 2>&1 | tail -4`
Expected: `0 fail`

## Task 5: Verify smoke script still surfaces name

**Files:** (verification)

- [ ] **Step 1: Run smoke script**

Run: `bun run scripts/smoke-name-recall.ts 2>&1 | tail -20`

Expected:
- Early "hi" replies are English ("hi.", "who are you?", "..." — not Thai)
- After "call me wutty", subsequent "do you remember me?" replies surface "wutty" in ≥ 2 of 5 attempts
- No `!! ERROR` lines

- [ ] **Step 2: If wutty surfaces 0/5, run smoke 4 more times**

Run: `for i in 1 2 3 4; do bun run scripts/smoke-name-recall.ts 2>&1 | grep wutty | wc -l; done`
Expected: each run produces ≥ 2 lines containing "wutty".

If consistently 0, STOP — the identity-pool fix has regressed. Investigate before proceeding.

## Task 6: Update README to document new default + how to swap

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read current README to find install/usage section**

Run: `head -60 README.md`
Identify the section that describes what npx hi-introvert produces.

- [ ] **Step 2: Add a short note about the default English companion + how to swap**

Add (location: right after install/usage section, or wherever feels natural) a short callout:

```markdown
## Companion variants

The default companion (`entities/companion.mdm`) is a minimal English seed (~26 lines) — the engine grows the rest from your conversation.

A fuller Thai bilingual variant lives at `entities/companion-th.mdm`. To use it, swap the filenames:

\`\`\`bash
mv entities/companion.mdm entities/companion-en.mdm
mv entities/companion-th.mdm entities/companion.mdm
\`\`\`
```

(The backticks above are escaped for the plan markdown. Use real backticks in the README.)

- [ ] **Step 3: Verify README renders**

Run: `head -80 README.md`
Eyeball that the new section is placed reasonably and doesn't break existing structure.

## Task 7: Commit the swap

**Files:** all touched above

- [ ] **Step 1: Stage everything**

Run: `git add entities/ README.md docs/superpowers/`

Run: `git status --short`
Expected:
- `R  entities/companion.mdm -> entities/companion-th.mdm`
- `A  entities/companion.mdm`
- `M  README.md`
- `A  docs/superpowers/specs/2026-05-26-companion-en-minimal-design.md`
- `A  docs/superpowers/plans/2026-05-26-companion-en-minimal.md`
- (any test fixes from Task 4b)

- [ ] **Step 2: Commit**

Run:

```bash
git commit -m "$(cat <<'EOF'
feat(mdm): minimal English companion as default; preserve Thai variant

Replace the 244-line bilingual companion.mdm with a 26-line English-only
seed. Decoration fields (cognition, world_mind, relationships, behavior,
notes, skills.learnable, dialogue.self_monologue) were never read by code
or were superseded by runtime initialization — strip them so the mds-core
engine carries the showcase weight: vocabulary, autonomous monologue,
emotion dynamics, and skill growth all emerge from interaction, not from
authored config.

The previous full Thai bilingual file is preserved at companion-th.mdm
(git mv keeps history). Swap the filenames to revert.

🤖 Generated with Claude Code
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit lands cleanly. If pre-commit hook fails, fix the underlying issue and create a NEW commit (do not amend).

- [ ] **Step 3: Verify commit**

Run: `git log --oneline -1 && git show --stat HEAD | head -15`
Expected: latest commit shows the rename + new file + README modification.

## Task 8: Final manual verification

**Files:** (verification only)

- [ ] **Step 1: Live TUI smoke (founder verification)**

Run: `rm -f .hi-introvert-session.json && bun run src/index.tsx`

Drive manually:
- Type `hi` × 3 → expect English intro cycle
- Type `call me Wutty` → expect `[identity] Wutty`
- Type `do you remember me?` × 5 → expect "wutty" surfacing in ≥ 2 replies
- Type `/growth` → expect Maturity > 0
- Status row → expect `cnv30 cre50 emp40 lrn60`
- Press Ctrl+C → expect session saved (autosave fires every 30s now)

- [ ] **Step 2: If anything feels off, file findings as follow-up tasks**

Don't fix in this round — the plan is scoped to the MDM swap. Note follow-ups for the next iteration (e.g., bump 1.2.7, npm publish, traveler.mdm).

---

## Self-review (engineer pre-execution check)

Before starting Task 1, glance through:

1. **Spec coverage:** Each section of the spec (goal/constraints/MDM content/removal table/cold-start UX/file ops/test impact/verification plan/risks/success criteria) — every one is touched by at least one task above.

2. **Type consistency:** No code types added; this is config-file work. Filenames are consistent (`companion-th.mdm`, `companion.mdm`).

3. **Placeholder scan:** No TBD/TODO/handwaving. The MDM content in Task 3 is the literal file content. Task 4b is conditional and explicit about what to do.

4. **Path correctness:** All paths use `entities/`, `docs/superpowers/`, `scripts/`. No invented directories.
