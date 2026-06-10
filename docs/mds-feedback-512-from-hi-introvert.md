# mds-core 5.12 feedback — from hi-introvert field use

> Source: hi-introvert live sessions + engine trace (2026-06-10).
> Verified against local `mds/` repo @ v5.11.1 (= published bundle).
> Role of this doc: consumer-side bug report / wishlist, carried into mds repo planning.

## F1 — `skills.learnable` in MDM is parsed then dropped (engine bug)

- `mdm-parser.ts:665-668` `parseSkills()` extracts skill names into `ParsedMaterialConfig.skillNames` — **nothing ever calls `entity.skills.addSkill()` with them**.
- `container.ts` `broadcastEvent()` dispatches emotion transitions / memory bindings / state machines, but **no skill-practice triggers**. Trigger names used in `companion.mdm` (`new_word_learned`, `user.emotion_detected`, `conversation_milestone`) exist nowhere in the engine.
- `world.tick()` only calls `skills.applyDecay(dt)` (`container.ts:1750`) — so a declared-but-never-practiced skill can only decay.
- **Symptom downstream:** hi-introvert `/growth` showed `cnv30 cre50 emp40 lrn60` frozen across 57 conversations.
- **5.12 ask:** instantiate parsed skills at spawn, and dispatch `entity.skills.practice(name, intensity)` from declarative triggers (same plumbing as `emotionTriggers`).

## F2 — PAD dominance axis has no event-driven writes (inert in practice)

- Dominance gets baseline drift (`state.ts:151-161`), micro-jitter (`container.ts:1462`), contagion (`container.ts:1620`) — same passive physics as V/A.
- But unlike valence/arousal there are **no dialogue/field/event paths that write dominance**. A companion that "grows self-assurance" must have the consumer call `entity.feel({dominance})` manually.
- **Symptom downstream:** hi-introvert's emotional-maturity metric originally weighted dominance 50% → stuck at 0%; app-side reformulated around memory-subject diversity as workaround.
- **5.12 ask:** dominance-affecting triggers in MDM (e.g. `{trigger: 'praise.received', effect: {dominance: '+0.1'}}`), parallel to emotion transitions.

## F3 — memory recall: engine already has `recallByTopic`, consumers reinvent it

- `buffer.ts:217-243` `recallByTopic(keywords, limit)` = Jaccard overlap × salience. `findSimilar()` similar. `.memories` getter = plain array (shape stable, good).
- Embedding similarity (`EntitySimilarityAdapter` / `SemanticSimilarity`, `container.ts:1012-1031`) is optional + **not wired into recall** — keyword Jaccard only.
- **Symptom downstream:** hi-introvert's `ContextAnalyzer.findRelevantMemories()` reimplemented keyword overlap over `JSON.stringify(content)` (the original name-recall bug); fixed app-side with `subject: 'user_name'` tagging — engine never helped.
- **5.12 ask:** (a) document `recallByTopic` as the canonical recall path; (b) optional embedding-backed recall behind the existing Similarity Provider so `memory.recall` can degrade gracefully keyword→semantic.

## F4 — Weather → environment composition invites compounding bugs (API shape)

- mds-core owns `Weather` (state) but leaves env application to consumers. hi-introvert applied rain effects via read-modify-write on `environment.config` every 2s tick → humidity saturated to 1.0 and wind multiplied exponentially between sensor resets.
- Fixed app-side with a pure `applyWeatherToEnvironment(base, weatherState)` (idempotent, composes from base — `src/sensors/OSSensor.ts`).
- **5.12 ask:** ship an equivalent pure composer in mds-core (or make `Environment` accept `{base, modifiers}` layers) so the safe pattern is the default one.

---

*Related app-side fixes shipped in hi-introvert (this session): CPU-usage double-count in OS→temperature mapping (idle read 30°C+, full load 110°C), macOS memory honesty via `vm_stat` (humidity pinned ~99%), idempotent weather composition.*
