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

The core emits typed events (`sessionStarted`, `questionAsked`, `answered`,
`streakMilestone`, `workingSetChanged`, `chordWoken`, `readyForUnlock`,
`levelUp`, `chordNapped`, `sessionComplete`). Heat travels on `answered`. Audio and celebrations
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
2. **Get-ready ritual** (§5.3): "Get Ready… Here they come!" over a grid
   of the child's characters; each chord plays in turn with its tile lit,
   then the first question.
3. The app plays a chord for 1.5–2.5 s (randomized).
4. Tiles for every **unlocked** chord are shown in fixed curriculum order.
   Each tile shows the chord color and character emoji. Letters are off by
   default (parent toggle). Tile positions never shuffle: spatial constancy
   helps young children, as Eguchi's fixed flag set does.
5. Child taps a tile.
   - **Correct:** tile pops, confetti in the chord's color, character
     bounces, ambient heat rises. No replay: the celebration is the
     confirmation. Auto-advance after 1.5 s, then a 0.5 s beat of silence
     before the next chord. The Hear-again speaker throbs from the moment
     a question begins until its chord has finished.
   - **Wrong:** tapped tile shakes gently, a descending two-tone "bee-oop"
     plays and the correct tile pulses so the child sees the answer; the
     chord is not replayed. Ambient heat cools. No penalty, no sad face.
     Auto-advance after 1.8 s.
   - **No three in a row:** the same chord is never asked more than twice
     consecutively.
6. A large **Hear again** button, centred under the progress trail, replays
   the current chord at any time. Replays are counted but do not affect
   scoring.
7. A progress trail shows identifications completed toward the session
   target (default 20, parent-configurable 10–50), in near-equal rows of at
   most ten dots so it never wraps unevenly. A correct answer fills its dot
   as a green disc with a checkmark that flies in; a miss leaves a hollow
   red ring.
8. If the pacing policy fires during the session, the level-up moment
   (§6.3) runs immediately and the session then continues with the new
   chord live.
9. **Overtime** (Unlimited pacing only): if the last trial at the target
   is correct but did not fire a level-up, an "Overtime!" pop and rainbow
   cannon fire and the session keeps asking until the streak reaches N
   (a level-up) or a miss ends it with the summary. Eguchi and Manual end
   at the target.
10. On reaching the target: **session summary** (§7.3). The child can also
   end early via a small exit control; an early exit still gets a summary,
   but a session counts toward the Eguchi policy's session gate only if it
   reached at least half the target. **Play again** on the summary starts a
   fresh session (cold streak, full working set) so an engaged child can
   chain sittings.

### 5.3 Get-ready ritual

Loading is a moment, not a spinner. After Play:

1. "Get Ready…" / "Here they come!" heads a grid of the child's unlocked
   characters on neutral tiles. Samples for the active chords and selected
   instrument load meanwhile.
2. If the browser will not start audio without a gesture (typically after a
   reload mid-session), a "Tap to start" button appears after 1 s and the
   ritual continues from the tap.
3. When loading is done, the chords play one by one in curriculum order
   (1.4 s apart); the playing character's tile fills with its colour and
   grows slightly. Tiles are not tappable here. A small **Skip** link
   under the grid jumps straight to the session.
4. The first chord plays.

If loading takes longer than 6 s a small "getting the sounds ready…" line
appears; §11 covers failure.

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
with a mini celebration ("Owl is awake!") and a short primer for the woken
chord alone: its tile lights up and its chord plays twice before the next
question. No pacing policy check, no spacing wait: recovery is fast by
design.

**Parent controls.** Settings show a badge when a chord is napping, a
"wake now" button, and a "rewind a level" control that removes the newest
chord from the unlocked set entirely (for a parent who judges the child
needs a longer step back). The stats view shows the current working set and
nap state.

Working-set and nap changes are engine state emitted via
`workingSetChanged`, `chordNapped` and `chordWoken`.

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
| **Unlimited** (default) | streak N = 10 | current in-session streak ≥ N. (Ten in a row means ten; the no-three-in-a-row selection rule already guarantees variety within the streak.) The only policy with session overtime (§5 step 9). |
| **Eguchi** | K = 40, D = 14 days, S = 10 sessions | accuracy over the last K answers is 100%, at least D days since the last unlock (or profile creation), and at least S sessions completed since then |
| **Manual** | — | never automatically; the home screen shows a "ready" badge when the Unlimited rule would fire, and the parent unlocks from settings |

No policy is consulted while a chord is napping. Switching policy mid-way is
safe because every policy is evaluated from history, not from its own
state. Parameters are clamped to sane ranges in
settings (N 3–50, K 10–200, D 0–60, S 0–100).

### 6.3 The level-up moment

When the policy says ready, the unlock happens immediately, mid-session:

1. Session input freezes; ambient heat flares to white-hot.
2. Full-screen takeover: fireworks that keep launching (one every 0.7 s) for
   as long as the screen is up, a drum fanfare and a short rising jingle
   (see §7.4).
3. A locked tile (🔒) in the new chord's colour shakes for 1 s, then the
   whole screen flashes white and the character is revealed with its name
   ("Meet Owl!") at peak brightness, 1.2 s in. Nothing plays automatically: "Tap to hear it", and
   tapping the tile plays the chord. Continue is enabled once revealed.
4. A **Continue** tap returns to the session screen with the new tile added
   in curriculum position, bouncing and glowing.
5. **Continue** closes the interrupted session quietly (it is recorded with
   its stars and its level-up, but no summary screen is shown, since the
   takeover was the celebration) and starts a fresh full session with the
   new chord live. A late unlock is therefore never cut short by the old
   session's target. There is no run-through of the whole set, which added
   noise without adding clarity. The new chord becomes the most recently
   unlocked chord for weighting; the streak starts at 0 so the next unlock
   is earned fresh.

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
| 1 | every correct answer | one confetti cannon in the chord's colors from just above-left of the first tile (always on screen), lobbing up and right and drifting down; character bounce; ambient heat step |
| 2 | streak milestone (every 5, configurable) | the same cannon, bigger and in rainbow colors; a big numeral (5, 10, 15…) pops to the centre, lingers about a second, then falls away with the confetti; three chimes, the tapped chord's notes an octave up in order; ★ awarded, heat ignites further, haptic. When the milestone is also the unlock (streak 10 by default) the session moves to the level-up as the chime ends, so the jingle follows it directly. |
| 3 | session complete | session summary (§7.3): confetti + fireworks, 1–3 stars by accuracy |
| 4 | level up | full-screen takeover (§6.3) — the biggest effect in the app |

Waking a napping chord (§5.2) sits between tiers 2 and 3.

### 7.1 Ambient heat

There is no meter object. The streak heats the *room*: the session screen
itself changes, in the spirit of Balatro's score fire, so the effect reads
as atmosphere rather than a gauge the child is told to watch.

- `heat = min(1, streak / 15)`; the glow width follows the square root of
  heat, so the very first correct answer already warms the edges and every
  further one adds to it gradually. Nothing appears suddenly at a threshold.
- **Edges:** a vignette around the screen edge shifts from neutral through
  amber and orange to white-hot as heat rises.
- **Tiles:** pick up a glow in the same palette; the just-answered tile
  glows strongest.
- **No counter:** the streak is never shown as a number during play; the
  room's warmth is the only indicator. Best streak lives in parent stats.
- **Flames:** from heat ≥ 0.5, flame particles rise gently from the bottom
  edge on a canvas layered *behind* the tiles, so they colour the room
  without ever covering a tile; intensity scales with heat.
- **Miss:** streak → 0; heat drains over ~1 s and the two-tone "bee-oop"
  plays. No particles. Cooling, not punishment.
- **Sessions start cold.** Heat and streak reset at session start so every
  session offers a fresh climb; the best streak persists for parent stats.

### 7.2 Celebration layer

One full-screen `<canvas>` above the UI, driven by a small custom particle
engine (object-pooled, `requestAnimationFrame`, capped particle count).
Emitters: burst, cannon (directional confetti from a point), fountain,
firework (launch + trail + bloom), confetti, flame (continuous), steam
(puff). Presets map tiers and moods to emitter parameters and palettes. The
canvas is sized in CSS pixels and drawn at device resolution, so effects
land where the tiles are on any pixel density.

Tiers: correct answer → one confetti cannon in the chord's colour and
"ding-ding"; streak milestone (5, 10) → bigger cannon, three chimes and a
numeral that pops over the grid, lingers, then falls; overtime → a large
rainbow cannon with a whoosh; level-up → continuous fireworks, fanfare and
jingle; session end → confetti rain, cymbal and jingle.

### 7.3 Session summary

The end-of-session screen is a celebration, not a scoreboard. Confetti,
fireworks and the session-end jingle, stars fly in one at a time (≥95% → 3, ≥80% → 2, else 1), the
awake characters cheer, and a short line of encouragement appears. Accuracy
and count are shown small. Buttons: **Play again**, **Home**. If a level-up
happened in this session the new character is featured on the card.

### 7.4 Sound and haptics

Celebration sounds are **unpitched** by default (whoosh, pop, drum,
cymbal): extra tones must not muddy the pitch exposure the app exists to
deliver. Exceptions: the chord itself; the correct-answer "ding-ding" (the
tapped chord's lowest and highest notes an octave up) and the milestone
chime (the whole chord an octave up), which echo the chord just heard
rather than adding a stray pitch, and give each chord its own sound; the
miss "bee-oop", a descending two-tone blip an octave below the vocabulary;
and two short bell jingles above it, a rising major arpeggio at level-up
played in the key of the chord whose answer earned the unlock (so ding-ding,
the three-chime and the jingle share a key) and a
four-note tune at session end, so those moments have a signature the child
recognises.
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
2. **Home** — star total, gear (parent gate), champion badge when
   applicable, then **Practice!**: a "My chords / All chords" toggle (saved
   per profile) above the real tile grid. Tapping a tile plays its chord, so
   a child can learn the sounds before being tested; this is also where a
   child who just likes pressing the squares gets to press all of them. In
   "All chords" the locked tiles show colour and a lock icon, no
   character: the character is earned. A napping chord is shown asleep. Big Play below the
   grid enters the ritual and the session; stopping a session records it
   and returns via the summary, so Home and a live session never coexist.
3. **Get-ready** — "Get Ready… Here they come!" grid run-through with
   Skip (§5.3).
4. **Session** — chord tiles (emoji filling half the tile), ambient heat
   vignette, progress trail, hear-again speaker that throbs while the
   chord plays, overtime badge when in overtime; a small Stop pinned to
   the top-left corner of the screen.
5. **Level-up takeover** — overlay and primer (§6.3).
6. **Session summary** — §7.3.
7. **Parent settings** — §9.

The app is dark-themed: a deep grey with a hint of purple (`#262231`) as the
ground, light text, and the chord colors carrying all the saturation.
Portrait phone first; tablet and desktop layouts widen the tile grid. Tile
grid is 2 columns up to 4 chords, 3 columns up to 9, 4 columns beyond.

## 11. Error handling

| Failure | Behaviour |
|---|---|
| Sample load fails | retry twice with backoff; fall back to piano; if piano also fails show a "can't load sounds" screen with retry |
| Audio context suspended | resume on next user tap; no output detection in v1 (a muted device gives no in-app hint) |
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
