# Core Chord Trainer — Design

**Date:** 2026-09-04
**Status:** Approved design, awaiting implementation plan
**Scope:** Sub-project 1 of the ear-trainer roadmap (see §12)

## 1. Purpose

A mobile-first web app that teaches children aged roughly 3–8 to identify
chords by ear, following Eguchi's Chord Identification Method, and that is
motivating enough that children want to come back. It is modelled on
pganssle's `cim` trainer (<https://github.com/pganssle/cim>) and improves on
it in four ways:

1. Every chord has a friendly character (color + emoji, art-ready) instead of
   color alone.
2. Being correct visibly *pops*: particle bursts, ambient heat, fireworks.
3. Progression is automatic and configurable, and a level-up feels like a
   power-up.
4. Multiple nicely sampled instruments, not a single piano.

Success for v1: a parent can hand a child a phone, the child completes
sessions unaided, unlocks new chords over days or weeks depending on the
chosen pacing policy, and asks to play again.

## 2. Reference: what `cim` does today

- Vanilla JS, Jekyll-built PWA on GitHub Pages, Capacitor Android wrapper.
- Tone.js `Sampler` with sampled piano.
- 14 chords: the nine Eguchi white-key triads (red CEG, yellow CFA, blue BDG,
  black ACF, green DGB, orange EGC, purple FAC, pink GBD, brown GCE) plus
  five black-key chords (gray A, tan D, light green E, light purple Bb, sky
  blue Eb).
- No automatic progression; the parent selects the active chord set.
- Sessions target 25 identifications; a cat emoji reacts to accuracy.
- Profiles, session history, `localStorage` persistence, JSON import/export.

Eguchi's protocol as documented there: ~5 sessions/day of 2–3 minutes; add a
new chord only at 100% accuracy; at least two weeks between new chords.

## 3. Architecture

**Approach:** framework-free TypeScript domain core + React shell.

```
src/
  core/                framework-free TypeScript, no DOM
    content/           chords, characters, instruments, curriculum (data)
    engine/
      session.ts       question selection, working set, answer handling
      progression.ts   level, streak, stats, unlock orchestration
      pacing/          unlimited.ts, eguchi.ts, manual.ts
      stats.ts         tallies, rolling window, accuracy helpers
      events.ts        typed domain event bus
    types.ts
  audio/               Tone.js player, sample loading, unpitched SFX
  celebrations/        particle engine, emitters, presets, ambient heat driver
  state/               Zustand store, persistence, schema migrations
  ui/                  React screens and components
public/samples/<instrument>/   self-hosted audio samples
```

The core emits typed events (`answered`, `streakMilestone`, `heatChanged`,
`sessionComplete`, `levelUp`, `workingSetChanged`, `napChanged`,
`chordWoken`). Audio and celebrations
subscribe to events; the engine never references the DOM, canvas, or Tone.js.
React renders from the store. This keeps progression rules — the part we will
keep tuning — unit-testable without a browser.

**Stack:** Vite, React, TypeScript, Zustand (with `persist`), Tone.js,
vite-plugin-pwa (Workbox), Vitest, React Testing Library, Playwright, ESLint,
Prettier.

**Hosting:** static `dist/` on AWS Amplify Hosting, deployed from `main`.
Asset paths are root-relative so GitHub Pages, Netlify, or a Capacitor
wrapper remain drop-in alternatives.

## 4. Content model

All content lives in `src/core/content/` as typed data, not code.

### Chord

| Field | Notes |
|---|---|
| `id` | stable slug, e.g. `red` |
| `notes` | exact Eguchi voicing as note names with octaves, e.g. `["C4","E4","G4"]`. Voicings are part of the method and must not be altered. |
| `label` | display label, e.g. `F/C` |
| `color` | Eguchi color (CSS value) |
| `character` | see below |

### Character

| Field | Notes |
|---|---|
| `name` | e.g. `Lion` |
| `emoji` | e.g. `🦁` |
| `mood` | `bright` \| `calm` \| `night` \| `sad` \| `mysterious`. Drives celebration palette and imagery tone. Only `bright`, `calm`, `night` are used by the v1 curriculum; the others exist so minor and altered chords slot in later. |
| `artUrl` | optional; empty in v1. When set, the UI renders the art instead of the emoji. |

### Default curriculum (order is the level order)

| # | Color | Chord | Notes | Character | Mood |
|---|---|---|---|---|---|
| 1 | red | C | C4 E4 G4 | 🦁 Lion | bright |
| 2 | yellow | F/C | C4 F4 A4 | 🐥 Chick | bright |
| 3 | blue | G/B | B3 D4 G4 | 🐳 Whale | calm |
| 4 | black | F/A | A3 C4 F4 | 🦉 Owl | night |
| 5 | green | G/D | D4 G4 B4 | 🐸 Frog | bright |
| 6 | orange | C/E | E4 G4 C5 | 🦊 Fox | bright |
| 7 | purple | F | F4 A4 C5 | 🦄 Unicorn | bright |
| 8 | pink | G | G4 B4 D5 | 🦩 Flamingo | bright |
| 9 | brown | C/G | G4 C5 E5 | 🐻 Bear | calm |
| 10 | gray | A | A3 C#4 E4 | 🐘 Elephant | calm |
| 11 | tan | D | D4 F#4 A4 | 🐪 Camel | bright |
| 12 | light green | E | E4 G#4 B4 | 🐢 Turtle | calm |
| 13 | light purple | Bb | Bb3 D4 F4 | 🐙 Octopus | night |
| 14 | sky blue | Eb | Eb4 G4 Bb4 | 🐬 Dolphin | bright |

Character choices are defaults and are expected to change; changing one is a
one-line data edit.

### Level

Derived, never stored. Level *k* (1-based) means the first *k+1* curriculum
chords are unlocked. Level 1 is red + yellow. The maximum level is
`curriculum.length - 1`; reaching it puts the profile in the "grand
champion" state (§6.5).

### Instrument

| Field | Notes |
|---|---|
| `id` | e.g. `piano` |
| `name` | display name |
| `emoji` | for the settings picker |
| `samples` | map of note name → sample file path |
| `release` | envelope release in seconds |

v1 ships a piano plus two or three contrasting instruments (candidates:
music box / celesta, strings, organ; final list decided during
implementation by what CC0/CC-BY sample sets are available). All are
selectable in parent settings. There is no unlock gating in v1.

## 5. Session flow

1. Child taps **Play** on the profile home. First tap starts the audio
   context (required by iOS).
2. **Get-ready ritual** (§5.3): the child's characters parade in while
   samples load, then a "Listen!" cue, then the first chord.
3. The app plays a chord for 1.5–2.5 s (randomized).
4. Tiles for every **unlocked** chord are shown in fixed curriculum order.
   Each tile shows the chord color and character emoji. Letters are off by
   default (parent toggle). Tile positions never shuffle: spatial constancy
   helps young children, as Eguchi's fixed flag set does.
5. Child taps a tile.
   - **Correct:** tile pops, particle burst in the chord's color, character
     bounces, ambient heat rises, the chord replays once as confirmation,
     then auto-advance after ~1 s.
   - **Wrong:** tapped tile shakes gently, the correct tile pulses and its
     chord replays, ambient heat cools. No penalty, no sad face.
     Auto-advance.
6. A **Hear again** button replays the current chord at any time. Replays
   are counted but do not affect scoring.
7. A progress trail shows identifications completed toward the session
   target (default 20, parent-configurable 10–50).
8. If the pacing policy fires during the session, the level-up moment
   (§6.3) runs immediately and the session then continues with the new
   chord live.
9. On reaching the target: **session summary** (§7.3), then home. The child
   can also end early via a small exit control.

### 5.3 Get-ready ritual

Loading is a moment, not a spinner. After Play:

1. The unlocked characters parade onto the screen one by one with pops.
   Samples for the active chords and selected instrument load meanwhile.
2. When loading is done and at least 1.5 s have passed, a "Listen!" cue
   appears with a pulsing ear emoji and a soft unpitched whoosh.
3. The first chord plays.

If loading takes longer than 6 s the parade loops and a small "getting the
sounds ready…" line appears; §11 covers failure.

### 5.1 Question selection

Each question picks one chord from the **working set** (§5.2) with weights:

- base weight 1 for every chord;
- the most recently unlocked chord: +1.5;
- each chord missed within the last 10 answers: +1 per miss;
- the chord just asked: ×0.3 (avoid immediate repeats unless the set is
  tiny).

No spaced-repetition scheduling in v1.

### 5.2 Recovery ladder (working set and napping)

The app is expected to be used intermittently, and children regress. When a
child struggles, the app first makes the task easier invisibly, then, if that
is not enough, gently steps back one chord while making recovery fast.
Recovering should feel like winning something back, never like being sent
down.

**Rung 1 — working set (invisible).** The **working set** is the prefix of
the awake chords that questions are drawn from, of size `w`, where
`2 ≤ w ≤ awake.length`. Tiles always show every unlocked chord regardless of
`w`.

- Normally `w = awake.length`.
- **Narrow** when accuracy over the last 8 answers of the current session
  falls below 60% (and at least 5 answers have been given):
  `w = max(2, floor(w / 2))`.
- **Narrow at session start** if the previous session ended more than 7 days
  ago: `w = max(2, ceil(awake.length / 2))`.
- **Widen** by one chord each time the child answers 3 in a row correctly
  while `w < awake.length`.
- `w` resets to full at the start of each session unless the idle rule
  applies.

**Rung 2 — napping (visible, kind).** If two consecutive completed sessions
each end below 70% accuracy, the most recently unlocked chord **takes a
nap**: its tile stays in place but turns soft and sleepy (💤 over the
character), it is not played, and tapping it does nothing. Effectively the
child is practising one level down. Only one chord naps at a time; the rule
does not fire again until the napping chord has woken.

**Waking.** A streak of 5 correct on the awake set wakes the napping chord
with a mini celebration ("Owl is awake!") and the primer sequence from
§6.3 step 5 runs for the woken chord alone. No pacing policy check, no
spacing wait: recovery is fast by design.

**Parent controls.** Settings show a badge when a chord is napping, a
"wake now" button, and a "rewind a level" control that removes the newest
chord from the unlocked set entirely (for a parent who judges the child
needs a longer step back). The stats view shows the current working set and
nap state.

Working-set and nap changes are engine state emitted via
`workingSetChanged` and `napChanged`.

## 6. Progression and pacing

### 6.1 Profile progression state

| Field | Notes |
|---|---|
| `level` | current level (§4) |
| `unlocks` | list of `{ chordId, unlockedAt }` |
| `streak` | current consecutive correct answers within this session; resets to 0 at session start |
| `bestStreak` | all-time best, for parent stats |
| `heat` | 0–1, derived from streak (§7.1); stored so it survives reload mid-session |
| `napping` | `chordId \| null`, see §5.2 |
| `chordStats` | per chord: `attempts`, `correct` |
| `recentAnswers` | last 100 `{ chordId, correct, at }`; rolling window used by pacing and downgrade rules |
| `sessions` | list of session summaries: `{ startedAt, endedAt, count, correct, levelAtStart, stars }` |
| `stars` | total stars earned |

### 6.2 Pacing policies

After every answer the engine asks the profile's **pacing policy** one
question: *may we unlock the next chord now?* A policy is a pure function of
`(progressionState, now) → { ready: boolean; reason: string }`. Three
policies ship, chosen in parent settings, each with editable parameters:

| Policy | Default | Ready when |
|---|---|---|
| **Unlimited** (default) | streak N = 10 | current in-session streak ≥ N and every awake chord has been answered correctly at least once during this streak |
| **Eguchi** | K = 40, D = 14 days, S = 10 sessions | accuracy over the last K answers is 100%, at least D days since the last unlock (or profile creation), and at least S sessions completed since then |
| **Manual** | — | never automatically; the home screen shows a "ready" badge when the Unlimited rule would fire, and the parent unlocks from settings |

No policy is consulted while a chord is napping. Switching policy mid-way is
safe because every policy is evaluated from history, not from its own
state. Parameters are clamped to sane ranges in
settings (N 3–50, K 10–200, D 0–60, S 0–100).

### 6.3 The level-up moment

When the policy says ready, the unlock happens immediately, mid-session:

1. Session input freezes; ambient heat flares to white-hot.
2. Full-screen takeover: fireworks barrage, unpitched fanfare (drums,
   whoosh, cymbal).
3. The new character is revealed with its name ("Meet Owl!"), its chord plays
   three times while the character dances. Tapping the character replays the
   chord.
4. A **Continue** tap returns to the session screen with the new tile added
   in curriculum position, bouncing and glowing.
5. **Primer:** the tiles light up one at a time in curriculum order, each
   playing its chord for ~1.2 s, ending on the new chord, which gets the
   biggest bounce and a second play. This re-anchors the whole set before
   the child is asked to discriminate within it. Input stays frozen until
   the primer ends.
6. The session resumes. The new chord becomes the most recently unlocked
   chord for weighting; the streak resets to 0 so the next unlock is earned
   fresh.

### 6.4 Stepping back

Automatic step-back is limited to napping the newest chord (§5.2), which
is always recoverable within one good session. The unlock record and level
are unchanged by a nap. Only a parent can remove a chord from the unlocked
set ("rewind a level") or reset a profile.

### 6.5 Grand champion

When all curriculum chords are unlocked, the pacing policy is never
consulted again. Streak milestones and session stars continue. The home
screen shows a champion badge. This is the hook where the curriculum
expansion (roadmap) will attach.

## 7. Rewards and celebrations

All celebrations are subscribers to engine events. Four tiers, each strictly
bigger than the last:

| Tier | Trigger | Effect |
|---|---|---|
| 1 | every correct answer | particle burst in chord color from the tile, character bounce, ambient heat step |
| 2 | streak milestone (every 5, configurable) | larger burst, ★ awarded, heat ignites further, haptic |
| 3 | session complete | session summary (§7.3): confetti + fireworks, 1–3 stars by accuracy |
| 4 | level up | full-screen takeover (§6.3) — the biggest effect in the app |

Waking a napping chord (§5.2) sits between tiers 2 and 3.

### 7.1 Ambient heat

There is no meter object. The streak heats the *room*: the session screen
itself changes, in the spirit of Balatro's score fire, so the effect reads
as atmosphere rather than a gauge the child is told to watch.

- `heat = min(1, streak / 15)` with easing.
- **Edges:** a vignette around the screen edge shifts from neutral through
  amber and orange to white-hot as heat rises.
- **Tiles:** pick up a glow in the same palette; the just-answered tile
  glows strongest.
- **Streak number:** hidden below 3; from 3 it appears in the header and
  grows and pulses with heat; at 1.0 it shakes ("blazing").
- **Flames:** from heat ≥ 0.5, flame particles lick in from the bottom edge;
  intensity scales with heat.
- **Miss:** streak → 0; heat drains over ~1 s with a puff of steam from the
  edges. Cooling, not punishment.
- **Sessions start cold.** Heat and streak reset at session start so every
  session offers a fresh climb; the best streak persists for parent stats.

### 7.2 Celebration layer

One full-screen `<canvas>` above the UI, driven by a small custom particle
engine (object-pooled, `requestAnimationFrame`, capped particle count).
Emitters: burst, fountain, firework (launch + trail + bloom), confetti,
flame (continuous), steam (puff). Presets map tiers and moods to emitter
parameters and palettes.

### 7.3 Session summary

The end-of-session screen is a celebration, not a scoreboard. Confetti and
fireworks, stars fly in one at a time (≥95% → 3, ≥80% → 2, else 1), the
awake characters cheer, and a short line of encouragement appears. Accuracy
and count are shown small. Buttons: **Play again**, **Home**. If a level-up
happened in this session the new character is featured on the card.

### 7.4 Sound and haptics

Celebration sounds are **unpitched** by default (whoosh, pop, drum,
cymbal): extra tones must not muddy the pitch exposure the app exists to
deliver. The only pitched sound in any celebration is the chord itself.
Haptics via `navigator.vibrate` where supported.

### 7.5 Intensity and accessibility

Parent setting: celebration intensity `full` | `medium` | `calm`.
`prefers-reduced-motion` forces `calm` (no shake, sparse particles, no
flames; the heat vignette still shifts color). Celebration sound has its own on/off toggle.

## 8. Audio

- Tone.js `Sampler` per instrument. Chosen over lighter sampler libraries
  because `Tone.Transport` scheduling is what rhythm and polyrhythm
  exercises will need later.
- Samples self-hosted under `public/samples/<instrument>/` as compressed
  audio, sourced from CC0 / CC-BY libraries (Salamander Grand Piano for
  piano; VSCO2 Community Edition and similar for the rest). Attributions go
  in `THIRD_PARTY_NOTICES.md`.
- Chord playback: all notes triggered simultaneously at fixed velocity for
  the randomized duration; release per instrument.
- Preload only the notes the awake chords need for the selected
  instrument, during the get-ready ritual (§5.3). Notes for a newly
  unlocked chord load during the level-up takeover.
- Service worker precaches the app shell and runtime-caches sample files,
  so the PWA works offline after first use.
- The audio context starts on the first Play tap and resumes on the next tap
  if the OS suspends it.

## 9. Persistence, profiles, parent gate

- Zustand store with `persist` middleware to `localStorage`, under a single
  versioned key. `version` + ordered migration functions from day one.
- **Profile:** `id`, `name`, `avatarEmoji`, `createdAt`, `settings`,
  `progression` (§6.1).
- **Settings (per profile):** pacing policy + parameters, instrument,
  session target, show letters, celebration intensity, celebration sound,
  haptics.
- **Parent gate:** a single-digit multiplication question (e.g. "7 × 8 = ?")
  guards the gear icon. Behind it: settings, stats (per-chord accuracy bars,
  recent sessions, best streak, current working set and nap state), manual
  unlock, wake now, rewind a level, level reset, profile delete, and JSON
  export/import of a profile so a family can move devices without a
  backend.

## 10. Screens

1. **Profile picker** — big avatar tiles, "new profile".
2. **Home** — big Play, strip of unlocked characters (napping one shown
   asleep), star total, gear (parent gate). Champion badge when applicable.
3. **Get-ready** — character parade and "Listen!" cue (§5.3).
4. **Session** — chord tiles, ambient heat vignette, streak number in the
   header, progress trail, hear-again, exit.
5. **Level-up takeover** — overlay and primer (§6.3).
6. **Session summary** — §7.3.
7. **Parent settings** — §9.

Portrait phone first; tablet and desktop layouts widen the tile grid. Tile
grid is 2 columns up to 4 chords, 3 columns up to 9, 4 columns beyond.

## 11. Error handling

| Failure | Behaviour |
|---|---|
| Sample load fails | retry twice with backoff; fall back to piano; if piano also fails show a "can't load sounds" screen with retry |
| Audio context suspended | resume on next user tap; a muted-speaker hint appears if playback produces no output twice |
| Corrupt or unknown-version persisted state | copy raw value to a backup key, reset to defaults, show a one-time notice with export of the backup |
| Storage write fails | keep running in memory, show a non-blocking warning in parent settings |
| Reduced-motion or low-end device | intensity clamps to `calm`; particle cap lowers when frame time exceeds 32 ms for 30 frames |

## 12. Testing

- **Vitest (core):** pacing policies against synthetic histories and a fake
  clock (Unlimited streak rule; Eguchi accuracy, spacing, and session gates;
  Manual never fires); selection weighting distributions; recovery ladder
  (working-set narrow/widen including the idle rule, nap trigger after two
  weak sessions, wake on streak of 5, policy suppressed while napping);
  per-session streak and heat reset; star bookkeeping; store migrations.
- **React Testing Library:** parent gate, tile-tap answer flow, napping
  tile is inert, level-up overlay and primer sequence render on `levelUp`.
- **Playwright:** one smoke test running a full session with audio stubbed
  and the celebration canvas present.
- **CI:** GitHub Actions runs typecheck, lint, unit tests, and build on every
  push and PR. Amplify Hosting deploys `dist/` from `main`.

## 13. Out of scope for v1

Rive mascots and adornments, instrument unlocks, at-home parent-delivered
mode, non-chord exercises (single notes, rhythm, polyrhythm), minor and
half-tone curricula, backend or accounts, Capacitor wrapper.

## 14. Roadmap (not this phase)

Recorded so the v1 model leaves room for them.

1. **Curriculum expansion:** single notes, half tones, minor and extended
   chords (Jacob Collier territory), rhythm and polyrhythm. Attaches at the
   grand-champion state as new curricula and new exercise types.
2. **Rewards economy:** instrument unlocks ("Organ unlocked!"), mascot with
   adornments (Rive), and **parent-defined rewards**: the parent sets what a
   level-up earns in the real world (allowance, screen time); the app only
   announces "You earned X!".
3. **At-home mode:** parent or teacher plays a real instrument; the app runs
   the answer/scoring side.
4. **Roguelite mode:** optional sudden-death run — one miss sends the run
   back to the start of the unlocked set, with heat-meter theatrics. Needs
   thought about whether it suits the youngest players; likely gated by age
   or parent setting.
