# Skill Growth Tiers — why "does the skill grow?" has three different answers

> Design note, 2026-06-10 (founder + GPT calibration + codebase trace, sealed the night F1 landed).
> Status: **architecture lens, not a backlog.** F1 (mds PR #16) covers Tier 1 only — deliberately.

MDS's skill system was designed in a world-simulation frame: the engine sees all
observable state, so growth binds to ground truth (`light_level<2` → phase_shift
practices). hi-introvert lives in a **meaning layer** where most interesting skills
have no physics sensor. That mismatch — not any single bug — is why `maturity 0%`
sat unsolved for weeks: a skill with no sensor has no trigger, so it reads zero forever.

## Tier 1 — Mechanical skills (event/condition driven) ✅ SHIPPED (F1)

- Ground truth exists as events or context: `new_word_learned`, `player.chat`, `light_level<2`
- Engine support: `skills.learnable` trigger dispatch + edge-triggered condition evaluation (mds PR #16)
- hi-introvert wiring: learning←`new_word_learned`, conversation←`conversation_milestone`

**Honesty note:** our `empathy ← user.emotion_detected (+0.05)` is a Tier-1 *proxy*
for a Tier-2 skill — "user expressed emotion near me" ≠ "I understood it". Acceptable
as placeholder; do not mistake it for measurement.

## Tier 2 — Semantic skills (conversation-evaluator driven) ⏳ NOT BUILT

- empathy, curiosity, reflection, active_listening — no single event can measure them
- Growth source: **analysis after the interaction**, not during it:
  `evaluateConversation(transcript) → { empathy: +0.02, reflection: +0.05 }`
- Existing seam: `ContextAnalyzer` already does per-message intent/emotion analysis —
  the evaluator is that idea lifted to whole-conversation scope. World already carries
  an `llm` config if the evaluator should be model-driven; a heuristic version
  (turn-taking ratio, question depth, callback-to-earlier-topics) is also viable.
- Engine ask (future mds): a `skills.evaluated` declaration alongside `skills.learnable`,
  fed by a consumer-provided evaluator — engine owns the growth curve, consumer owns meaning.

## Tier 3 — Longitudinal skills (memory + relationship driven) ⏳ NOT BUILT

- trust, attachment, maturity — grow over weeks of consistency, not per message
- Growth source: reading accumulated state — memory subject diversity, consolidation
  patterns, relationship/trust trajectories, return-after-absence behavior
- **Already half-discovered:** the maturity fix (0.5×dominance + 0.5×memory-subject
  diversity) is a proto-Tier-3 estimator — it reads accumulation, not events. That's
  why it worked where the trigger model couldn't.
- Substrate already exists: TrustSystem, MemoryConsolidation, relationship decay.
  Missing piece = a periodic longitudinal pass that converts those signals into growth.

## Rules of thumb

1. Before declaring a skill, ask **which tier it belongs to**. Declaring a Tier-2/3
   skill with a Tier-1 trigger doesn't fail loudly — it grows on noise (worse than 0%).
2. Tier-1 proxies for higher tiers are allowed but must be labeled as proxies.
3. `/spawn` is deferred behind this on purpose: once companions multiply, the question
   stops being "does the skill exist?" and becomes "what does it grow FROM?" —
   answer the growth question first.
