# hi-introvert — next session resume

**Last touched:** 2026-06-10 (Scrutinize + sensor-truth session)
**Location:** `side-projects/hi-introvert/` (FLAT — the old nested wrapper is gone)
**Git:** ⚠️ history LOST in the 2026-06-10 folder flatten (dotfiles didn't survive the move). Fresh `git init` on `main`, `.gitignore` recreated, **no commits yet** — founder to make the baseline commit. npm `hi-introvert@1.2.9` (ships `src/`) is the surviving pre-session snapshot.
**Tests:** 129 pass / 1 skip / 0 fail · **Version:** 1.2.9 (published)
**Vibe:** side-project, after-hours, treat with humor

---

## What changed this session (2026-06-10)

### Sensor truth pass — "ทำไม companion บ่นร้อนตลอด" solved
- **Temperature double-count fixed** (`src/sensors/OSSensor.ts`): old formula added CPU usage twice (directly + via usage-derived `cpuTemp`) → idle read 30°C+, full load 110°C, and the `>30°C → 'ร้อน'/🥵` vocab push fired constantly. Now idle = 20°C neutral, full load = 50°C.
- **Humidity un-pinned on macOS**: `os.freemem()` counts file cache as used (usage ~0.95 always → humidity ~99%). Now reads `vm_stat` (free+inactive+speculative+purgeable = available) with freemem fallback. Live check: mem 65.6% → humidity 46%.
- **Weather compounding fixed** (`WorldSession`): the 2s rain tick used to read-modify-write env config (humidity saturated, wind grew exponentially between 10s OS resets). Now composes idempotently from `envBase` via pure `applyWeatherToEnvironment()`.
- Tests: `tests/OSSensor.test.ts` (9 tests, incl. the "ร้อนเกินจริง" regression).
- **wttr.in is NOT part of this conflict** — it only broadcasts `outside_weather` events + memories, never writes env config.

### Menu wiring
- `/history` → `formatEventLog(session.getAllEvents())` (`src/ui/format-events.ts`, last 20 events)
- `/autosave [on|off]` → wired to `toggleAutoSave()` (no arg = toggle)
- `/q` → exit alias
- `/spawn` → still an honest "coming soon" stub (LLM-spawn is real work, deliberately not started)
- Tests: `tests/commands.test.ts` extended (stub-regression + formatEventLog).

### mds-core 5.12 feedback (engine trace, the "ยกไปปรับปรุง mds" payoff)
→ **`docs/mds-feedback-512-from-hi-introvert.md`** — 4 findings with file:line evidence:
1. **F1:** MDM `skills.learnable` parsed then dropped; no trigger dispatch; tick only decays → why skill levels freeze (engine bug)
2. **F2:** PAD dominance has no event-driven writes (passive drift/jitter/contagion only)
3. **F3:** engine already has `memory.recallByTopic()` (Jaccard) but consumers reinvent recall; embeddings not wired in
4. **F4:** Weather→environment composition should ship as a pure idempotent helper in-engine

## Status of the old known bugs (from 2026-05-25 file)

- **Bug 1 name recall** — FIXED in a post-05-25 session (`tests/regressions/name-recall-end-to-end.test.ts` passes; `subject: 'user_name'` tagging)
- **Bug 2 maturity 0%** — FIXED app-side (reformulated around memory-subject diversity; `tests/maturity.test.ts` passes). Engine-side dominance gap remains → F2.
- **Bug 3 skills don't tick** — app-side survival-on-load works (`tests/skills-survive-load.test.ts`), but proficiency still can't advance until mds F1 lands. Engine bug, not app bug.
- **Observation 4 extreme env** — root-caused & fixed (this session's sensor truth pass)

---

## Next session — candidates

1. **Founder: baseline commit** (`git add -A && git commit`) — repo currently has zero commits
2. **Field-feel test** — run `bun run dev`, confirm companion stopped complaining about heat/humidity all day
3. **mds 5.12 pass in `mds/` repo** — implement F1 (skills trigger dispatch) first; it unblocks hi-introvert skill growth with zero app changes
4. **/spawn decision** — implement LLM spawn or drop from help
5. Optional housekeeping (from old file, still pending): deprecate broken `@v1b3x0r/mds-core@5.11.0` on npm; decide GitHub remote; bump to 1.3.0 when E1-E3 feel right

## Quick-start

```bash
cd /Users/v1b3_/_dev/project-world-log/side-projects/hi-introvert
bun install        # node_modules also died in the flatten
bun test           # expect 129 pass / 1 skip
bun run dev        # interactive companion (npx hi-introvert = published 1.2.9, not local)
```

Older strata: `audit-5.11.md`, `docs/superpowers/{specs,plans}/2026-05-25-*` (design rationale still valid).

---

*Generated 2026-06-10. If this file is older than 2 weeks and HEAD has moved, regenerate.*
