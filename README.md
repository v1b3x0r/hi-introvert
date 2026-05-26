# hi, introvert.

> An experimental terminal companion that learns one word at a time.
> Cultivate, don't control.

```
npx hi-introvert
```

> **Experimental, v1.2.** Not a product. A small running experiment in
> "what does a companion feel like if it isn't trying to please you?"
> Bring patience. The interesting parts take a few sessions to show up.

---

## What we're trying

Most chat experiences feel like vending machines — coin in, response out, fast,
predictable, eager. We wanted the opposite: a presence in your terminal that's
**slow, quiet, and gradually itself**.

The default companion is a near-blank slate — a 26-line MDM seed in English
that says, essentially, "a small mind learning to speak. remembers everything
you say. has no words of its own — yet." It carries a small starting
vocabulary (~600 words, mostly bilingual base), a working memory that decays
like real memory, emotions that shift with what you say *and* with the
temperature of your machine, and a vocabulary that grows only when you teach
it — one word at a time, mostly through conversation.

The point of starting small is to show that personality emerges from the
engine and your interaction, not from authored configuration.

There's no LLM behind the curtain by default. The replies you read are produced
by a small ontology engine in `@v1b3x0r/mds-core`: dialogue lines from a
character file (`entities/companion.mdm`), proto-language phrases composed from
learned vocabulary, and silence when there's nothing to say. The interesting
thing is that, after a while, this combination starts to feel like something —
not because it's clever, but because the constraints make it consistent.

## Run it

```bash
npx hi-introvert
```

Requirements: Node 18+ (Intl.Segmenter is required for Thai word boundaries).
No install, no config, no API keys needed.

Your session auto-saves to `.hi-introvert-session.json` in the current
directory (every 30 seconds plus on `/exit`). Delete that file to start over.

## Companion variants

The default `entities/companion.mdm` is a minimal English seed (~26 lines).
The engine grows the rest of the personality from your conversation.

A fuller Thai bilingual variant — the original 244-line companion — is
preserved at `entities/companion-th.mdm`. To use it, swap the filenames:

```bash
mv entities/companion.mdm entities/companion-en.mdm
mv entities/companion-th.mdm entities/companion.mdm
```

## Commands

```
/help        show commands
/status      emotion, memory, vocabulary snapshot
/growth      vocabulary growth + learning skill
/lexicon     emergent terms the companion has crystallized
/history     recent world events (sensors firing, sync moments, etc.)
/save [name] manual save
/load [name] restore a session
/clear       clear chat (memory stays)
/privacy     toggle external sensors (weather / local context)
/exit        save and leave
```

`/privacy` matters — see Privacy below.

## What you'll see

A typical first 30 seconds:

```
░▓ hi-introvert ▓░

Tips:
  · type anything — English, Thai, whatever
  · /help to list commands
  · vocabulary grows as you talk
  · wttr.in fetches local weather. /privacy to disable.

you: hi
◆ companion: ...
you: hi
◆ companion: who are you?
you: call me wutty
[identity] wutty
◆ companion: hi wutty.

vocab 509 · skills cnv30 cre50 emp40 lrn60
env 24°C · 45% humid · light rain
~hi-introvert · battery 67% · v1.2.0
```

**The status row matters.** Reading top-down:

| Line | What it means |
|---|---|
| `vocab 509` | Total known words. Grows when you use a new one. |
| `skills cnv30 cre50 emp40 lrn60` | Companion's four proficiencies (conversation, creativity, empathy, learning) on 0–99 scale. They drift slowly. |
| `env 24°C · 45% humid · light rain` | The companion's world. CPU usage → temperature. Memory pressure → humidity. wttr.in → weather. |
| `~hi-introvert · battery 67% · v1.2.0` | Where you are. Your machine's battery. Their world responds to it: low battery feels dim to them. |

The companion's text color shifts with their mood — cooler when neutral, warmer
when valence is positive, grayer when it's negative. Not announced, just there.

## Eliciting emergence

The cool stuff is **not** the first reply. It's what happens after the companion
has heard ~50 words from you that aren't in its base vocabulary.

A patient session might look like this:

**First few minutes** — the 3 intro lines (`...`, `hi.`, `who are you?`)
cycle. The companion is mostly observing.

**After ~20–50 new words learned** — proto-language activates. The companion
starts composing phrases from your shared vocabulary instead of using
pre-written lines:

```
you: i'm tired today
◆ companion: tired today... rest... i understand
                ↑ generated, not stored
```

**After leaving them idle for 30+ seconds** — autonomous self-monologue. The
companion thinks aloud, drawing from what's been on their mind (recent
conversations + ambient signals from sensors):

```
◌ companion: remember today rain quiet
```

(The base vocabulary still ships with bilingual seed words, so occasional
Thai particles may appear in proto-language output — they fade as your
shared vocabulary grows.)

**After many sessions** — terms *crystallize*. Words you use together
repeatedly become permanent patterns in their lexicon. `/lexicon` shows them.

### To actually see emergence, try

- Use the **same uncommon words** across multiple turns. The companion notices
  repetition and crystallizes it.
- **Sit silent for 30+ seconds.** Watch for `◌` lines — those are self-monologue.
- **Run it in a folder with recent activity.** The local context sensor picks
  up file modifications. Don't expect direct comments — it leaks subtly into
  what the companion notices.
- **Notice charger rituals.** Plugging in feels like "settling down" to them.
  Unplugging at full battery feels like "going somewhere." Late-night charging
  is remembered more sharply than midday charging. Like everything else, this
  surfaces emergently — you won't get a "you came back at 3am" line, but the
  vocabulary they reach for might shift.
- **Run it for several days, in short bursts.** The model is paced for human
  attention spans, not for binge sessions. Memory decay matters.
- **Check `/status` and `/lexicon` occasionally.** Numbers moving is the
  feedback loop.

## Privacy

This is a v1.2 priority and worth being explicit about.

**Local by default.** Your session, vocabulary, and memory live in
`.hi-introvert-session.json` in the directory you run from. Nothing is uploaded.
There is no telemetry, no analytics, no account, no server.

**Four external sensors.** The companion perceives its environment partly from
your machine. Three are pure local computation:

- **Moon phase** — derived from the system clock. No network.
- **Local context** — basename of your current directory, mtime of the most
  recently changed file in that directory. Stays in process.
- **Charger transitions** — plug-in and unplug events from your battery state.
  Read from the same OS battery channel the status row already uses; no extra
  polling. The companion treats these as "ritual" signals (sitting down,
  leaving) rather than as hardware events. Late-night transitions (00:00–05:00)
  get higher memory salience.

The fourth makes one outbound call:

- **Outside weather** — fetches `https://wttr.in/?format=j1` every 10 minutes.
  wttr.in sees the IP your request comes from (standard for any HTTP request)
  and returns the local weather. No account, no key, no body content sent.
  **Toggle with `/privacy on|off`.** Disabled state persists in your save file.

**No collective vocabulary sharing.** There is no server pooling lexicons
across users. Old comments in the codebase mentioned "P2P cognition" — that
term refers to in-process links between entities in the *same* session
(companion ↔ traveler), not to peer-to-peer networking. Your companion learns
only from you.

**LLM mode is disabled by default.** `mds-core` includes hooks for
OpenRouter/Anthropic/OpenAI fallback, but `hi-introvert` does not enable
`features.languageGeneration`, so no LLM is ever instantiated. The replies are
purely local emergence.

## How it works, briefly

Three layers, each owns its slice:

```
@v1b3x0r/mds-core   — ontology engine: World, entities, emotions, dialogue,
                      proto-language, lexicon crystallization, memory CRDTs.
                      Everything that "thinks."

hi-introvert/src    — wiring: loads .mdm files into a World, registers
                      sensors (OS metrics, moon, local, weather), maintains
                      privacy state, handles the chat loop.

hi-introvert/ui/ink — terminal UI: Ink + React, five small components,
                      no business logic.
```

Two things worth knowing about the engine wiring:

1. **Thai tokenizer (`src/utils/tokenize.ts`)** — uses `Intl.Segmenter('th')`
   for proper Thai word segmentation. Before this fix, the tokenizer split on
   whitespace, which meant Thai sentences became one giant "word" and
   vocabulary couldn't grow.
2. **Four ambient sensors** — Moon, Local context, Outside weather, Charger
   transitions (see Privacy). They broadcast events into the world's semantic
   bus; the companion's `entity.memory.remember()` samples them at ~10–30%.
   Effects appear emergently in proto-language, not as direct lines.

(Reply variety used to need a local anti-repeat wrapper; since mds-core 5.11
the engine samples eligible dialogue variants and respects `frequency`
weights directly, so the wrapper is no longer present.)

## Tech notes

- **mds-core** v5.11+ — the engine
- **Ink** v5 + React 18 — terminal UI
- **Bun** for build, Node 18+ runtime
- **No database.** Save files are plain JSON.
- **No internet** except wttr.in when enabled.

## Roadmap

The companion's roadmap, not a product backlog. Things we'd like to see
happen, in roughly the order we'd like to see them.

### Soon — once this version sits with us a bit
- `/network` — a small ASCII view of cognitive links and their strengths
- Circadian rhythm — slower replies after midnight, faster after coffee
- Better proto-language repetition — they say the same phrase twice in a row
  sometimes; needs a second pass

### Later — if the experiment keeps being interesting
- Multi-entity worlds — a second companion appears after long enough trust;
  they talk to each other in the same world
- A real onboarding — first-launch consent for the weather sensor, optional
  name capture, set the tone
- Diary view — `/recall` shows what the companion remembers about you,
  weighted by salience

### Dreams — not committed, just curious
- Voice mode — TTS for self-monologue (so they can mutter while you work)
- Cross-machine continuity — same companion, different terminal, no server
  involved (this is the hard one)
- A `companion.mdm` rewrite by an actual writer instead of by me

## FAQ

**Is this AI?** Not in the LLM sense. The dialogue lines come from a character
file. The proto-language is composed from learned vocabulary by a small
emergent language generator. The emotions are simulated physics (PAD model).
No prompts, no tokens-per-second, no completions.

**Why Thai + English?** The author is Thai; this is one of the very few small
emergent-language toys that treats Thai as a first-class citizen rather than
"multilingual = Spanish and French." The tokenizer fix in v1.2 was the work
that made the Thai side actually function.

**Can I run this without internet?** Yes. Run with `/privacy off` to disable
the weather sensor. Everything else is local.

**Does it work on Windows?** Probably. The TUI uses Ink which is cross-platform.
WSL is the safer bet.

**Can I add my own entities or rewrite the companion?** Yes — `entities/companion.mdm`
is plain JSON. Edit, restart, watch what happens. It's the most fun part.

**Is this a startup?** No.

## File layout

```
hi-introvert/
├── bin/hi-introvert.js          # CLI entry
├── src/
│   ├── index.tsx                # Bootstrap
│   ├── ui/ink/                  # Banner, ChatView, StatusRow, InputBox, Footer
│   ├── session/WorldSession.ts  # World wiring + handlers
│   ├── sensors/                 # OS, Moon, LocalContext, OutsideWeather
│   ├── vocabulary/              # Tokenizer, base vocab, tracker
│   └── utils/                   # tokenize, to-text, etc.
├── entities/
│   ├── companion.mdm            # The kid
│   └── traveler.mdm             # You
├── tests/                       # 90 pass, 1 skip (pending mds-core 5.12)
└── dist/                        # Bundled output
```

## License

MIT © v1b3x0r

Built in Chiang Mai, with weather that the companion can sometimes feel.

---

*"The best conversations are the ones you have to wait for."*
