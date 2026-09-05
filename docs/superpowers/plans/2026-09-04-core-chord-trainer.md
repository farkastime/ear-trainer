# Core Chord Trainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 ear-trainer: an installable mobile-first PWA that teaches children Eguchi chord identification with characters, ambient heat, particle celebrations, configurable pacing, a recovery ladder, and sampled instruments.

**Architecture:** A framework-free TypeScript core (`src/core`) holds content and a pure, reducer-style session engine that returns new state plus a list of typed events. A Zustand store applies engine results, persists profiles to `localStorage`, and re-emits events on a tiny event bus. React screens render store state; the audio player and the canvas celebration layer subscribe to the bus and never touch engine internals.

**Tech Stack:** Vite 8, React 19, TypeScript 6 (template pin `~6.0.2`), Zustand 5, Tone.js 15, vite-plugin-pwa 1, Vitest 5 + jsdom + Testing Library, Playwright, oxlint (template default), Prettier. Node ≥ 22 (dev machine has 26).

**Spec:** `docs/superpowers/specs/2026-09-04-core-chord-trainer-design.md`

## Global Constraints

- Chord voicings are exactly the spec §4 table; never transpose or re-voice.
- Level *k* = `unlocks.length - 1`; level 1 = red + yellow; max level = 13 (14 chords). Never store level.
- Tiles never shuffle: always curriculum order.
- Celebration sounds are unpitched; the only pitched sound in a celebration is a chord.
- Sessions start cold: `streak = 0`, `heat = 0` at session start. `bestStreak` persists.
- Pacing defaults: Unlimited N=10 (range 3–50); Eguchi K=40 (10–200), D=14 days (0–60), S=10 sessions (0–100).
- Session target default 20, range 10–50. A session counts for pacing only if `count >= ceil(target/2)`.
- Recovery ladder: narrow when last-8 accuracy < 60% with ≥5 answers, at most once per 8 answers; idle > 7 days → start at `max(2, ceil(awake/2))`; widen by 1 after 3 correct in a row; nap newest chord after two consecutive counted sessions < 70%; wake on in-session streak of 5; only one chord naps; at least 2 chords stay awake.
- Heat: `min(1, streak / 15)`. Stars: ≥95% → 3, ≥80% → 2, else 1. Streak milestone every 5 → +1 star.
- Persisted state has a `version` and migration path from day one. Corrupt state is backed up to a separate key, never silently dropped.
- Asset paths root-relative. No host-specific config in app code.
- Samples are downloaded at build time by `scripts/fetch-samples.ts` into `public/samples/` (gitignored). Attribution in `THIRD_PARTY_NOTICES.md`.
- Comments follow `~/.claude/CLAUDE.md`: say what and why, one or two lines, no derivations.
- Commit messages end with the two attribution lines shown in Task 1.

---

## File Structure

```
ear-trainer/
  package.json, vite.config.ts, vitest.config.ts, tsconfig*.json, index.html, amplify.yml
  .github/workflows/ci.yml
  scripts/fetch-samples.ts            downloads sample files listed in instruments.ts
  public/icons/                       PWA icons (SVG + PNG)
  public/samples/<instrument>/        downloaded, gitignored
  src/
    main.tsx                          mounts <App/> inside providers
    core/
      types.ts                        all shared domain types
      content/chords.ts               14 chords + characters (data)
      content/curriculum.ts           level helpers, awake set, initial unlocks
      content/instruments.ts          4 instruments with sample maps (data)
      engine/rng.ts                   seedable RNG + weightedPick
      engine/stats.ts                 accuracy, stars, heat
      engine/selection.ts             question weighting
      engine/workingSet.ts            narrow / widen rules
      engine/nap.ts                   nap / wake rules
      engine/pacing/types.ts          PacingPolicy signature
      engine/pacing/unlimited.ts
      engine/pacing/eguchi.ts
      engine/pacing/manual.ts
      engine/pacing/index.ts          registry + defaults + clamps
      engine/events.ts                EngineEvent union
      engine/session.ts               startSession / answer / advance / continueAfterLevelUp / endSession
    state/
      profile.ts                      newProfile, default settings
      eventBus.ts                     onEngineEvent / emitEngineEvents
      storage.ts                      safe localStorage wrapper with backup-on-corrupt
      migrations.ts                   version + migrate()
      store.ts                        Zustand store (profiles, session, screen, actions)
      exportImport.ts                 profile JSON export / import
    audio/
      notes.ts                        noteToMidi, nearestSamples
      player.ts                       AudioPlayer interface + createNullPlayer
      tonePlayer.ts                   Tone.js implementation
      sfx.ts                          unpitched synthesized SFX
      duration.ts                     randomized chord duration
    celebrations/
      particles.ts                    ParticleSystem (pool, tick, draw)
      emitters.ts                     burst / fountain / firework / confetti / flame / steam
      presets.ts                      mood palettes, intensity scaling
      heat.ts                         heat → colors / CSS vars
      anchors.ts                      tile position registry for bursts
      haptics.ts
      CelebrationLayer.tsx            full-screen canvas bound to the event bus
    ui/
      App.tsx                         screen switch
      AudioContext.tsx                provides AudioPlayer + Sfx
      styles.css
      screens/ProfilePicker.tsx
      screens/Home.tsx
      screens/GetReady.tsx
      screens/Session.tsx
      screens/LevelUp.tsx
      screens/Summary.tsx
      screens/ParentGate.tsx
      screens/ParentSettings.tsx
      components/ChordTile.tsx
      components/TileGrid.tsx
      components/ProgressTrail.tsx
      components/StreakBadge.tsx
      components/CharacterParade.tsx
      hooks/usePrimer.ts
      hooks/useReducedMotion.ts
  e2e/session.spec.ts
  THIRD_PARTY_NOTICES.md, README.md
```

Test files live next to the code as `*.test.ts(x)`.

---

### Task 1: Scaffold the project

**Files:**
- Create: everything `npm create vite` generates, plus `vitest.config.ts`, `src/test/setup.ts`, `.prettierrc`, `.gitignore` additions, `README.md`
- Test: `src/core/sanity.test.ts` (deleted in Task 2)

**Interfaces:**
- Produces: `npm run dev|build|test|typecheck|lint|format`. Vitest with jsdom and jest-dom matchers.

- [ ] **Step 1: Generate the Vite React TS template into the repo root**

The repo already has `LICENSE`, `README.md`, `specs/`, `docs/`. Generate into a temp dir and copy in, so nothing existing is clobbered.

```bash
cd /home/tim/projects/farkastime/ear-trainer
npm create vite@latest .vite-tmp -- --template react-ts
cp -rn .vite-tmp/. .
rm -rf .vite-tmp
git status --short
```

Expected: new `package.json`, `index.html`, `src/`, `public/`, `tsconfig*.json`, `vite.config.ts`, `.gitignore`. `README.md` and `LICENSE` untouched (`cp -n`).

- [ ] **Step 2: Fix package name and add dependencies**

```bash
npm pkg set name="ear-trainer" version="0.1.0"
npm install zustand tone
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event vite-plugin-pwa prettier @playwright/test
```

- [ ] **Step 3: Add scripts**

```bash
npm pkg set scripts.test="vitest run" scripts.test:watch="vitest" scripts.typecheck="tsc -b" scripts.format="prettier --write ." scripts.format:check="prettier --check ." scripts.samples="node scripts/fetch-samples.ts" scripts.e2e="playwright test"
```

- [ ] **Step 4: Write `vitest.config.ts` and setup file**

`vitest.config.ts`:
```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
})
```

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

Add `"src/test"` is already under `src`, so `tsconfig.app.json` includes it. Add `"types": ["vite/client", "vitest/globals"]` is **not** needed; tests import from `vitest` explicitly.

- [ ] **Step 5: Prettier config and gitignore**

`.prettierrc`:
```json
{ "semi": false, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```

Append to `.gitignore`:
```
# downloaded at build time by scripts/fetch-samples.ts
public/samples/
# playwright
test-results/
playwright-report/
```

- [ ] **Step 6: Replace template `src/` content with a minimal app**

Delete `src/App.css`, `src/assets/`, `src/index.css`. Write `src/App.tsx`:
```tsx
export function App() {
  return <h1>Ear Trainer</h1>
}
```
`src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 7: Write a sanity test**

`src/core/sanity.test.ts`:
```ts
import { describe, expect, it } from 'vitest'

describe('toolchain', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 8: Run everything**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
Expected: typecheck clean, lint clean, 1 test passes, `dist/` produced.

- [ ] **Step 9: Write README**

Replace `README.md` body with:
```markdown
# Ear Trainer

A mobile-first PWA that teaches young children to identify chords by ear
(Eguchi Chord Identification Method), with characters, celebrations, and
configurable progression.

Design: `docs/superpowers/specs/2026-09-04-core-chord-trainer-design.md`

## Develop

    npm install
    npm run samples     # downloads instrument samples into public/samples/
    npm run dev

## Check

    npm run typecheck && npm run lint && npm test && npm run build
    npm run e2e         # needs: npx playwright install chromium

## Deploy

Static `dist/`. `amplify.yml` builds it on AWS Amplify Hosting; any static
host works.
```

- [ ] **Step 10: Commit**

```bash
npm run format
git add -A
git commit -m "Scaffold Vite + React + TS app with Vitest

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01522w5owBeJis39bnJ6zgq2"
```

Every later commit in this plan ends with those same two trailer lines; they are omitted from the remaining commit steps for brevity but are required.

---

### Task 2: Domain types, chords, curriculum helpers

**Files:**
- Create: `src/core/types.ts`, `src/core/content/chords.ts`, `src/core/content/curriculum.ts`
- Test: `src/core/content/chords.test.ts`, `src/core/content/curriculum.test.ts`
- Delete: `src/core/sanity.test.ts`

**Interfaces:**
- Produces (types.ts): `Mood`, `Character`, `Chord`, `Instrument`, `PacingPolicyId`, `PacingParams`, `Intensity`, `ProfileSettings`, `Answer`, `SessionSummary`, `Unlock`, `ChordStat`, `Progression`, `Profile`.
- Produces (chords.ts): `CHORDS: readonly Chord[]`, `chordById(id: string): Chord`.
- Produces (curriculum.ts): `DEFAULT_CURRICULUM: readonly string[]`, `MAX_LEVEL`, `levelOf(unlocks)`, `nextChordId(unlocks)`, `unlockedChordIds(unlocks)`, `awakeChordIds(progression)`, `initialUnlocks(now)`, `isChampion(progression)`, `newestUnlockedId(unlocks)`.

- [ ] **Step 1: Write `src/core/types.ts`**

```ts
export type Mood = 'bright' | 'calm' | 'night' | 'sad' | 'mysterious'

export interface Character {
  name: string
  emoji: string
  mood: Mood
  /** When set, the UI renders this instead of the emoji. Empty in v1. */
  artUrl?: string
}

export interface Chord {
  id: string
  /** Exact Eguchi voicing with octaves; part of the method, do not re-voice. */
  notes: readonly string[]
  label: string
  color: string
  character: Character
}

export interface Instrument {
  id: string
  name: string
  emoji: string
  baseUrl: string
  /** note name -> file name relative to baseUrl */
  samples: Readonly<Record<string, string>>
  release: number
  attribution: string
}

export type PacingPolicyId = 'unlimited' | 'eguchi' | 'manual'

export interface PacingParams {
  streakTarget: number
  eguchiWindow: number
  eguchiDays: number
  eguchiSessions: number
}

export type Intensity = 'full' | 'medium' | 'calm'

export interface ProfileSettings {
  pacing: PacingPolicyId
  pacingParams: PacingParams
  instrumentId: string
  sessionTarget: number
  showLetters: boolean
  intensity: Intensity
  celebrationSound: boolean
  haptics: boolean
}

export interface Answer {
  chordId: string
  correct: boolean
  at: number
}

export interface SessionSummary {
  startedAt: number
  endedAt: number
  count: number
  correct: number
  levelAtStart: number
  stars: number
  leveledUp: boolean
  /** false for early exits shorter than half the target */
  countsForPacing: boolean
}

export interface Unlock {
  chordId: string
  unlockedAt: number
}

export interface ChordStat {
  attempts: number
  correct: number
}

export interface Progression {
  unlocks: Unlock[]
  napping: string | null
  /** Sessions before this timestamp are ignored by the nap rule. */
  lastNapChangeAt: number
  streak: number
  bestStreak: number
  heat: number
  chordStats: Record<string, ChordStat>
  /** Rolling window, newest last, capped at RECENT_ANSWERS_CAP. */
  recentAnswers: Answer[]
  sessions: SessionSummary[]
  stars: number
  /** Manual pacing only: the Unlimited rule fired and a parent may unlock. */
  readyForUnlock: boolean
}

export interface Profile {
  id: string
  name: string
  avatarEmoji: string
  createdAt: number
  settings: ProfileSettings
  progression: Progression
}

export const RECENT_ANSWERS_CAP = 100
```

- [ ] **Step 2: Write the failing chords test**

`src/core/content/chords.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { CHORDS, chordById } from './chords'

describe('CHORDS', () => {
  it('has the 14 curriculum chords in Eguchi order', () => {
    expect(CHORDS.map((c) => c.id)).toEqual([
      'red', 'yellow', 'blue', 'black', 'green', 'orange', 'purple', 'pink', 'brown',
      'gray', 'tan', 'lightgreen', 'lightpurple', 'skyblue',
    ])
  })

  it('uses the exact Eguchi voicings', () => {
    const voicings = Object.fromEntries(CHORDS.map((c) => [c.id, c.notes.join(' ')]))
    expect(voicings).toEqual({
      red: 'C4 E4 G4',
      yellow: 'C4 F4 A4',
      blue: 'B3 D4 G4',
      black: 'A3 C4 F4',
      green: 'D4 G4 B4',
      orange: 'E4 G4 C5',
      purple: 'F4 A4 C5',
      pink: 'G4 B4 D5',
      brown: 'G4 C5 E5',
      gray: 'A3 C#4 E4',
      tan: 'D4 F#4 A4',
      lightgreen: 'E4 G#4 B4',
      lightpurple: 'Bb3 D4 F4',
      skyblue: 'Eb4 G4 Bb4',
    })
  })

  it('has unique ids, colors and emoji', () => {
    const unique = (xs: string[]) => new Set(xs).size === xs.length
    expect(unique(CHORDS.map((c) => c.id))).toBe(true)
    expect(unique(CHORDS.map((c) => c.color))).toBe(true)
    expect(unique(CHORDS.map((c) => c.character.emoji))).toBe(true)
  })

  it('looks up by id and throws on unknown', () => {
    expect(chordById('black').character.name).toBe('Owl')
    expect(() => chordById('nope')).toThrow(/unknown chord/)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

```bash
rm src/core/sanity.test.ts
npx vitest run src/core/content/chords.test.ts
```
Expected: FAIL, cannot resolve `./chords`.

- [ ] **Step 4: Write `src/core/content/chords.ts`**

```ts
import type { Chord } from '../types'

export const CHORDS: readonly Chord[] = [
  { id: 'red', notes: ['C4', 'E4', 'G4'], label: 'C', color: '#e53935',
    character: { name: 'Lion', emoji: '🦁', mood: 'bright' } },
  { id: 'yellow', notes: ['C4', 'F4', 'A4'], label: 'F/C', color: '#fdd835',
    character: { name: 'Chick', emoji: '🐥', mood: 'bright' } },
  { id: 'blue', notes: ['B3', 'D4', 'G4'], label: 'G/B', color: '#1e88e5',
    character: { name: 'Whale', emoji: '🐳', mood: 'calm' } },
  { id: 'black', notes: ['A3', 'C4', 'F4'], label: 'F/A', color: '#212121',
    character: { name: 'Owl', emoji: '🦉', mood: 'night' } },
  { id: 'green', notes: ['D4', 'G4', 'B4'], label: 'G/D', color: '#43a047',
    character: { name: 'Frog', emoji: '🐸', mood: 'bright' } },
  { id: 'orange', notes: ['E4', 'G4', 'C5'], label: 'C/E', color: '#fb8c00',
    character: { name: 'Fox', emoji: '🦊', mood: 'bright' } },
  { id: 'purple', notes: ['F4', 'A4', 'C5'], label: 'F', color: '#8e24aa',
    character: { name: 'Unicorn', emoji: '🦄', mood: 'bright' } },
  { id: 'pink', notes: ['G4', 'B4', 'D5'], label: 'G', color: '#ec407a',
    character: { name: 'Flamingo', emoji: '🦩', mood: 'bright' } },
  { id: 'brown', notes: ['G4', 'C5', 'E5'], label: 'C/G', color: '#6d4c41',
    character: { name: 'Bear', emoji: '🐻', mood: 'calm' } },
  { id: 'gray', notes: ['A3', 'C#4', 'E4'], label: 'A', color: '#9e9e9e',
    character: { name: 'Elephant', emoji: '🐘', mood: 'calm' } },
  { id: 'tan', notes: ['D4', 'F#4', 'A4'], label: 'D', color: '#d2b48c',
    character: { name: 'Camel', emoji: '🐪', mood: 'bright' } },
  { id: 'lightgreen', notes: ['E4', 'G#4', 'B4'], label: 'E', color: '#9ccc65',
    character: { name: 'Turtle', emoji: '🐢', mood: 'calm' } },
  { id: 'lightpurple', notes: ['Bb3', 'D4', 'F4'], label: 'Bb', color: '#ce93d8',
    character: { name: 'Octopus', emoji: '🐙', mood: 'night' } },
  { id: 'skyblue', notes: ['Eb4', 'G4', 'Bb4'], label: 'Eb', color: '#4fc3f7',
    character: { name: 'Dolphin', emoji: '🐬', mood: 'bright' } },
]

const BY_ID = new Map(CHORDS.map((c) => [c.id, c]))

export function chordById(id: string): Chord {
  const chord = BY_ID.get(id)
  if (!chord) throw new Error(`unknown chord: ${id}`)
  return chord
}
```

- [ ] **Step 5: Run chords test**

```bash
npx vitest run src/core/content/chords.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 6: Write the failing curriculum test**

`src/core/content/curriculum.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Progression } from '../types'
import {
  DEFAULT_CURRICULUM, MAX_LEVEL, awakeChordIds, initialUnlocks, isChampion, levelOf,
  newestUnlockedId, nextChordId, unlockedChordIds,
} from './curriculum'

function progressionWith(ids: string[], napping: string | null = null): Progression {
  return {
    unlocks: ids.map((chordId, i) => ({ chordId, unlockedAt: i })),
    napping, lastNapChangeAt: 0, streak: 0, bestStreak: 0, heat: 0,
    chordStats: {}, recentAnswers: [], sessions: [], stars: 0, readyForUnlock: false,
  }
}

describe('curriculum', () => {
  it('starts at level 1 with red and yellow', () => {
    const unlocks = initialUnlocks(1000)
    expect(unlocks).toEqual([
      { chordId: 'red', unlockedAt: 1000 },
      { chordId: 'yellow', unlockedAt: 1000 },
    ])
    expect(levelOf(unlocks)).toBe(1)
  })

  it('derives level from unlock count and caps at MAX_LEVEL', () => {
    expect(MAX_LEVEL).toBe(13)
    const all = progressionWith([...DEFAULT_CURRICULUM])
    expect(levelOf(all.unlocks)).toBe(13)
    expect(isChampion(all)).toBe(true)
    expect(nextChordId(all.unlocks)).toBeNull()
  })

  it('names the next chord in curriculum order', () => {
    expect(nextChordId(initialUnlocks(0))).toBe('blue')
    expect(newestUnlockedId(initialUnlocks(0))).toBe('yellow')
  })

  it('excludes the napping chord from the awake set', () => {
    const p = progressionWith(['red', 'yellow', 'blue', 'black'], 'black')
    expect(unlockedChordIds(p.unlocks)).toEqual(['red', 'yellow', 'blue', 'black'])
    expect(awakeChordIds(p)).toEqual(['red', 'yellow', 'blue'])
    expect(isChampion(p)).toBe(false)
  })
})
```

- [ ] **Step 7: Run to verify it fails**

```bash
npx vitest run src/core/content/curriculum.test.ts
```
Expected: FAIL, cannot resolve `./curriculum`.

- [ ] **Step 8: Write `src/core/content/curriculum.ts`**

```ts
import type { Progression, Unlock } from '../types'
import { CHORDS } from './chords'

export const DEFAULT_CURRICULUM: readonly string[] = CHORDS.map((c) => c.id)
export const MAX_LEVEL = DEFAULT_CURRICULUM.length - 1

export function levelOf(unlocks: readonly Unlock[]): number {
  return unlocks.length - 1
}

export function unlockedChordIds(unlocks: readonly Unlock[]): string[] {
  return unlocks.map((u) => u.chordId)
}

export function newestUnlockedId(unlocks: readonly Unlock[]): string {
  return unlocks[unlocks.length - 1].chordId
}

export function nextChordId(unlocks: readonly Unlock[]): string | null {
  return DEFAULT_CURRICULUM[unlocks.length] ?? null
}

export function awakeChordIds(progression: Progression): string[] {
  return unlockedChordIds(progression.unlocks).filter((id) => id !== progression.napping)
}

export function initialUnlocks(now: number): Unlock[] {
  return DEFAULT_CURRICULUM.slice(0, 2).map((chordId) => ({ chordId, unlockedAt: now }))
}

export function isChampion(progression: Progression): boolean {
  return progression.unlocks.length === DEFAULT_CURRICULUM.length
}
```

- [ ] **Step 9: Run both tests**

```bash
npx vitest run src/core/content
```
Expected: PASS (8 tests).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add domain types, chord content, and curriculum helpers"
```

---

### Task 3: Instruments and the sample download script

**Files:**
- Create: `src/core/content/instruments.ts`, `scripts/fetch-samples.ts`, `THIRD_PARTY_NOTICES.md`
- Test: `src/core/content/instruments.test.ts`

**Interfaces:**
- Produces: `INSTRUMENTS: readonly Instrument[]`, `instrumentById(id)`, `DEFAULT_INSTRUMENT_ID = 'piano'`, `SAMPLE_SOURCES: Record<string, string>` (instrument id → remote base URL used only by the script).
- Sample file names follow both sources' convention: sharps written as `s` (`Ds4.mp3`); the note key uses `#` (`D#4`).

- [ ] **Step 1: Write the failing test**

`src/core/content/instruments.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_INSTRUMENT_ID, INSTRUMENTS, SAMPLE_SOURCES, instrumentById } from './instruments'
import { CHORDS } from './chords'

const NOTE_RE = /^[A-G]#?\d$/

describe('INSTRUMENTS', () => {
  it('ships piano, organ, harp and violin with piano as default', () => {
    expect(INSTRUMENTS.map((i) => i.id)).toEqual(['piano', 'organ', 'harp', 'violin'])
    expect(DEFAULT_INSTRUMENT_ID).toBe('piano')
    expect(instrumentById('organ').name).toBe('Organ')
    expect(() => instrumentById('kazoo')).toThrow(/unknown instrument/)
  })

  it('uses root-relative baseUrl and well-formed sample maps', () => {
    for (const inst of INSTRUMENTS) {
      expect(inst.baseUrl).toBe(`/samples/${inst.id}/`)
      expect(Object.keys(inst.samples).length).toBeGreaterThanOrEqual(6)
      for (const [note, file] of Object.entries(inst.samples)) {
        expect(note).toMatch(NOTE_RE)
        expect(file).toBe(note.replace('#', 's') + '.mp3')
      }
      expect(SAMPLE_SOURCES[inst.id]).toMatch(/^https:\/\//)
      expect(inst.attribution.length).toBeGreaterThan(10)
    }
  })

  it('covers the chord range so no note is repitched more than 6 semitones', () => {
    const midi = (n: string) => {
      const m = /^([A-G])(#|b)?(\d)$/.exec(n)!
      const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C']!
      const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
      return (Number(m[3]) + 1) * 12 + base + acc
    }
    const needed = [...new Set(CHORDS.flatMap((c) => c.notes))].map(midi)
    for (const inst of INSTRUMENTS) {
      const have = Object.keys(inst.samples).map(midi)
      for (const n of needed) {
        const nearest = Math.min(...have.map((h) => Math.abs(h - n)))
        expect(nearest, `${inst.id} near midi ${n}`).toBeLessThanOrEqual(6)
      }
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/core/content/instruments.test.ts
```
Expected: FAIL, cannot resolve `./instruments`.

- [ ] **Step 3: Write `src/core/content/instruments.ts`**

This file is imported by a Node script, so it imports nothing at runtime (type-only import).

```ts
import type { Instrument } from '../types'

function map(notes: string[]): Record<string, string> {
  return Object.fromEntries(notes.map((n) => [n, n.replace('#', 's') + '.mp3']))
}

export const DEFAULT_INSTRUMENT_ID = 'piano'

/** Remote origins the build-time script downloads from. Not used by the app. */
export const SAMPLE_SOURCES: Record<string, string> = {
  piano: 'https://tonejs.github.io/audio/salamander/',
  organ: 'https://nbrosowsky.github.io/tonejs-instruments/samples/organ/',
  harp: 'https://nbrosowsky.github.io/tonejs-instruments/samples/harp/',
  violin: 'https://nbrosowsky.github.io/tonejs-instruments/samples/violin/',
}

export const INSTRUMENTS: readonly Instrument[] = [
  {
    id: 'piano', name: 'Piano', emoji: '🎹', baseUrl: '/samples/piano/', release: 1.2,
    samples: map(['A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6']),
    attribution: 'Salamander Grand Piano by Alexander Holm, CC-BY 3.0, via tonejs.github.io',
  },
  {
    id: 'organ', name: 'Organ', emoji: '🎛️', baseUrl: '/samples/organ/', release: 0.6,
    samples: map(['A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6']),
    attribution: 'VSCO 2 Community Edition organ via nbrosowsky/tonejs-instruments, CC-BY 3.0',
  },
  {
    id: 'harp', name: 'Harp', emoji: '🪕', baseUrl: '/samples/harp/', release: 2.0,
    samples: map(['A2', 'C3', 'E3', 'G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5', 'G5', 'B5']),
    attribution: 'VSCO 2 Community Edition harp via nbrosowsky/tonejs-instruments, CC-BY 3.0',
  },
  {
    id: 'violin', name: 'Strings', emoji: '🎻', baseUrl: '/samples/violin/', release: 1.0,
    samples: map(['A3', 'C4', 'E4', 'G4', 'A4', 'C5', 'E5', 'G5', 'A5', 'C6']),
    attribution: 'VSCO 2 Community Edition violin via nbrosowsky/tonejs-instruments, CC-BY 3.0',
  },
]

const BY_ID = new Map(INSTRUMENTS.map((i) => [i.id, i]))

export function instrumentById(id: string): Instrument {
  const inst = BY_ID.get(id)
  if (!inst) throw new Error(`unknown instrument: ${id}`)
  return inst
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run src/core/content/instruments.test.ts
```
Expected: PASS (3 tests). If the coverage test fails for a note, add the missing sample note to that instrument's list, checking it exists at the source (`curl -sI <base><file>`; every note listed above was verified to exist).

- [ ] **Step 5: Write `scripts/fetch-samples.ts`**

Node 22.18+ runs `.ts` directly (type stripping). The import uses an explicit `.ts` extension, which Node requires and `allowImportingTsExtensions` permits.

```ts
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { INSTRUMENTS, SAMPLE_SOURCES } from '../src/core/content/instruments.ts'

const OUT_ROOT = new URL('../public/samples/', import.meta.url).pathname

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false)
}

async function fetchWithRetry(url: string, attempts = 3): Promise<ArrayBuffer> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return await res.arrayBuffer()
    } catch (err) {
      lastError = err
      await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
  throw lastError
}

let downloaded = 0
let skipped = 0
for (const inst of INSTRUMENTS) {
  const dir = join(OUT_ROOT, inst.id)
  await mkdir(dir, { recursive: true })
  for (const file of Object.values(inst.samples)) {
    const target = join(dir, file)
    if (await exists(target)) {
      skipped++
      continue
    }
    const bytes = await fetchWithRetry(SAMPLE_SOURCES[inst.id] + file)
    await writeFile(target, Buffer.from(bytes))
    downloaded++
    process.stdout.write(`${inst.id}/${file}\n`)
  }
}
console.log(`samples: ${downloaded} downloaded, ${skipped} already present`)
```

- [ ] **Step 6: Run the script and check output**

```bash
npm run samples
ls public/samples/*/ | head
du -sh public/samples
```
Expected: 50 files across four directories, roughly 10–15 MB total. Second run prints `0 downloaded, 50 already present`.

- [ ] **Step 7: Write `THIRD_PARTY_NOTICES.md`**

```markdown
# Third-party notices

## Audio samples (downloaded at build time into `public/samples/`, not committed)

- **Salamander Grand Piano** by Alexander Holm — CC-BY 3.0.
  Served from <https://tonejs.github.io/audio/salamander/>.
- **VSCO 2 Community Edition** (organ, harp, violin) — packaged by
  Nicholaus Brosowsky in <https://github.com/nbrosowsky/tonejs-instruments>,
  samples CC-BY 3.0.

Attribution strings shown in the app's parent settings come from
`src/core/content/instruments.ts`.

## Libraries

See `package.json`; all are MIT-licensed.
```

- [ ] **Step 8: Typecheck (the script must not break `tsc -b`)**

`tsconfig.node.json` includes only `vite.config.ts` by default; add `"scripts/**/*.ts"` to its `include` array so the script is typechecked.

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add instrument content, sample fetch script, third-party notices"
```

---

### Task 4: RNG and stats helpers

**Files:**
- Create: `src/core/engine/rng.ts`, `src/core/engine/stats.ts`
- Test: `src/core/engine/rng.test.ts`, `src/core/engine/stats.test.ts`

**Interfaces:**
- Produces: `type Rng = () => number`, `mulberry32(seed): Rng`, `weightedPick<T>(items, weights, rng): T`.
- Produces: `accuracy(answers): number` (0 when empty), `lastN<T>(arr, n): T[]`, `starsFor(correct, count): 1|2|3`, `heatFor(streak): number`, `HEAT_MAX_STREAK = 15`, `MILESTONE_EVERY = 5`.

- [ ] **Step 1: Write failing tests**

`src/core/engine/rng.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { mulberry32, weightedPick } from './rng'

describe('mulberry32', () => {
  it('is deterministic and in [0,1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const xs = Array.from({ length: 5 }, () => a())
    expect(xs).toEqual(Array.from({ length: 5 }, () => b()))
    for (const x of xs) expect(x).toBeGreaterThanOrEqual(0)
    for (const x of xs) expect(x).toBeLessThan(1)
  })
})

describe('weightedPick', () => {
  it('picks proportionally to weight', () => {
    const rng = mulberry32(7)
    const counts = { a: 0, b: 0 }
    for (let i = 0; i < 10000; i++) counts[weightedPick(['a', 'b'], [3, 1], rng) as 'a' | 'b']++
    expect(counts.a / counts.b).toBeGreaterThan(2.6)
    expect(counts.a / counts.b).toBeLessThan(3.4)
  })

  it('never picks zero-weight items', () => {
    const rng = mulberry32(1)
    for (let i = 0; i < 1000; i++) expect(weightedPick(['a', 'b'], [0, 1], rng)).toBe('b')
  })

  it('throws when all weights are zero or lengths differ', () => {
    expect(() => weightedPick(['a'], [0], () => 0.5)).toThrow()
    expect(() => weightedPick(['a', 'b'], [1], () => 0.5)).toThrow()
  })
})
```

`src/core/engine/stats.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Answer } from '../types'
import { HEAT_MAX_STREAK, accuracy, heatFor, lastN, starsFor } from './stats'

const ans = (correct: boolean, i = 0): Answer => ({ chordId: 'red', correct, at: i })

describe('stats', () => {
  it('accuracy is 0 for empty and a ratio otherwise', () => {
    expect(accuracy([])).toBe(0)
    expect(accuracy([ans(true), ans(false), ans(true), ans(true)])).toBe(0.75)
  })

  it('lastN returns the tail without mutating', () => {
    const xs = [1, 2, 3, 4]
    expect(lastN(xs, 2)).toEqual([3, 4])
    expect(lastN(xs, 10)).toEqual([1, 2, 3, 4])
    expect(xs).toEqual([1, 2, 3, 4])
  })

  it('stars follow the spec thresholds', () => {
    expect(starsFor(20, 20)).toBe(3)
    expect(starsFor(19, 20)).toBe(3)
    expect(starsFor(18, 20)).toBe(2)
    expect(starsFor(16, 20)).toBe(2)
    expect(starsFor(15, 20)).toBe(1)
    expect(starsFor(0, 0)).toBe(1)
  })

  it('heat ramps to 1 at HEAT_MAX_STREAK', () => {
    expect(HEAT_MAX_STREAK).toBe(15)
    expect(heatFor(0)).toBe(0)
    expect(heatFor(5)).toBeCloseTo(1 / 3)
    expect(heatFor(15)).toBe(1)
    expect(heatFor(40)).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/core/engine
```
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/core/engine/rng.ts`:
```ts
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function weightedPick<T>(items: readonly T[], weights: readonly number[], rng: Rng): T {
  if (items.length !== weights.length) throw new Error('weightedPick: length mismatch')
  const total = weights.reduce((s, w) => s + w, 0)
  if (total <= 0) throw new Error('weightedPick: all weights zero')
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r < 0 && weights[i] > 0) return items[i]
  }
  for (let i = items.length - 1; i >= 0; i--) if (weights[i] > 0) return items[i]
  throw new Error('weightedPick: unreachable')
}
```

`src/core/engine/stats.ts`:
```ts
import type { Answer } from '../types'

export const HEAT_MAX_STREAK = 15
export const MILESTONE_EVERY = 5

export function accuracy(answers: readonly Answer[]): number {
  if (answers.length === 0) return 0
  return answers.filter((a) => a.correct).length / answers.length
}

export function lastN<T>(arr: readonly T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n))
}

export function starsFor(correct: number, count: number): 1 | 2 | 3 {
  if (count === 0) return 1
  const ratio = correct / count
  if (ratio >= 0.95) return 3
  if (ratio >= 0.8) return 2
  return 1
}

export function heatFor(streak: number): number {
  return Math.min(1, streak / HEAT_MAX_STREAK)
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/core/engine
```
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add seedable RNG and stats helpers"
```

---

### Task 5: Question selection weighting

**Files:**
- Create: `src/core/engine/selection.ts`
- Test: `src/core/engine/selection.test.ts`

**Interfaces:**
- Consumes: `Rng`, `weightedPick` (Task 4); `Answer` (Task 2).
- Produces: `interface SelectionContext { workingSet: string[]; recentAnswers: Answer[]; lastAskedId: string | null; newestChordId: string | null }`, `weightsFor(ctx): number[]`, `pickChord(ctx, rng): string`, constants `NEWEST_BONUS = 1.5`, `MISS_BONUS = 1`, `MISS_WINDOW = 10`, `REPEAT_FACTOR = 0.3`.

- [ ] **Step 1: Write failing test**

`src/core/engine/selection.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Answer } from '../types'
import { mulberry32 } from './rng'
import { pickChord, weightsFor, type SelectionContext } from './selection'

const a = (chordId: string, correct: boolean, at = 0): Answer => ({ chordId, correct, at })

describe('weightsFor', () => {
  it('gives base weight 1 to every working-set chord', () => {
    const ctx: SelectionContext = {
      workingSet: ['red', 'yellow'], recentAnswers: [], lastAskedId: null, newestChordId: null,
    }
    expect(weightsFor(ctx)).toEqual([1, 1])
  })

  it('boosts the newest chord and recently missed chords', () => {
    const ctx: SelectionContext = {
      workingSet: ['red', 'yellow', 'blue'],
      recentAnswers: [a('red', false), a('red', false), a('yellow', true)],
      lastAskedId: null,
      newestChordId: 'blue',
    }
    expect(weightsFor(ctx)).toEqual([3, 1, 2.5])
  })

  it('only counts misses within the last 10 answers', () => {
    const old = Array.from({ length: 10 }, (_, i) => a('yellow', true, i))
    const ctx: SelectionContext = {
      workingSet: ['red', 'yellow'],
      recentAnswers: [a('red', false), ...old],
      lastAskedId: null,
      newestChordId: null,
    }
    expect(weightsFor(ctx)).toEqual([1, 1])
  })

  it('dampens the chord just asked', () => {
    const ctx: SelectionContext = {
      workingSet: ['red', 'yellow'], recentAnswers: [], lastAskedId: 'red', newestChordId: null,
    }
    expect(weightsFor(ctx)).toEqual([0.3, 1])
  })

  it('ignores newest/missed chords outside the working set', () => {
    const ctx: SelectionContext = {
      workingSet: ['red', 'yellow'],
      recentAnswers: [a('blue', false)],
      lastAskedId: null,
      newestChordId: 'blue',
    }
    expect(weightsFor(ctx)).toEqual([1, 1])
  })
})

describe('pickChord', () => {
  it('draws from the working set with the computed weights', () => {
    const rng = mulberry32(3)
    const ctx: SelectionContext = {
      workingSet: ['red', 'yellow'], recentAnswers: [], lastAskedId: null, newestChordId: 'yellow',
    }
    const counts = { red: 0, yellow: 0 }
    for (let i = 0; i < 5000; i++) counts[pickChord(ctx, rng) as 'red' | 'yellow']++
    expect(counts.yellow / counts.red).toBeGreaterThan(2.1)
    expect(counts.yellow / counts.red).toBeLessThan(2.9)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/core/engine/selection.test.ts
```
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/core/engine/selection.ts`**

```ts
import type { Answer } from '../types'
import { type Rng, weightedPick } from './rng'
import { lastN } from './stats'

export const NEWEST_BONUS = 1.5
export const MISS_BONUS = 1
export const MISS_WINDOW = 10
export const REPEAT_FACTOR = 0.3

export interface SelectionContext {
  workingSet: string[]
  recentAnswers: Answer[]
  lastAskedId: string | null
  newestChordId: string | null
}

export function weightsFor(ctx: SelectionContext): number[] {
  const recentMisses = lastN(ctx.recentAnswers, MISS_WINDOW).filter((a) => !a.correct)
  return ctx.workingSet.map((id) => {
    let w = 1
    if (id === ctx.newestChordId) w += NEWEST_BONUS
    w += MISS_BONUS * recentMisses.filter((a) => a.chordId === id).length
    if (id === ctx.lastAskedId) w *= REPEAT_FACTOR
    return w
  })
}

export function pickChord(ctx: SelectionContext, rng: Rng): string {
  return weightedPick(ctx.workingSet, weightsFor(ctx), rng)
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/core/engine/selection.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add weighted question selection"
```

---

### Task 6: Working set rules

**Files:**
- Create: `src/core/engine/workingSet.ts`
- Test: `src/core/engine/workingSet.test.ts`

**Interfaces:**
- Consumes: `Answer`, `accuracy`, `lastN`.
- Produces: `interface WorkingSet { size: number; widenStreak: number; lastNarrowedAtCount: number }`, `initialWorkingSet(awakeCount, lastSessionEndedAt, now): WorkingSet`, `updateWorkingSet(ws, awakeCount, sessionAnswers): WorkingSet`, constants `IDLE_MS = 7 days`, `NARROW_MIN_ANSWERS = 5`, `NARROW_WINDOW = 8`, `NARROW_THRESHOLD = 0.6`, `WIDEN_STREAK = 3`, `MIN_WORKING_SET = 2`.

`sessionAnswers` is the full list of this session's answers including the one just given.

- [ ] **Step 1: Write failing test**

`src/core/engine/workingSet.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Answer } from '../types'
import { IDLE_MS, initialWorkingSet, updateWorkingSet, type WorkingSet } from './workingSet'

const DAY = 24 * 60 * 60 * 1000
const a = (correct: boolean): Answer => ({ chordId: 'red', correct, at: 0 })
const full = (size: number): WorkingSet => ({ size, widenStreak: 0, lastNarrowedAtCount: -Infinity })

describe('initialWorkingSet', () => {
  it('is the full awake set normally', () => {
    expect(initialWorkingSet(6, 1000, 1000 + DAY).size).toBe(6)
    expect(initialWorkingSet(6, null, 1000).size).toBe(6)
  })

  it('halves (rounding up, min 2) after more than 7 idle days', () => {
    expect(IDLE_MS).toBe(7 * DAY)
    expect(initialWorkingSet(6, 0, IDLE_MS + 1).size).toBe(3)
    expect(initialWorkingSet(5, 0, IDLE_MS + 1).size).toBe(3)
    expect(initialWorkingSet(2, 0, IDLE_MS + 1).size).toBe(2)
    expect(initialWorkingSet(6, 0, IDLE_MS).size).toBe(6)
  })
})

describe('updateWorkingSet', () => {
  it('narrows when last-8 accuracy drops below 60% after 5+ answers', () => {
    const answers = [a(true), a(false), a(false), a(false), a(false)]
    const ws = updateWorkingSet(full(8), 8, answers)
    expect(ws.size).toBe(4)
    expect(ws.lastNarrowedAtCount).toBe(5)
  })

  it('does not narrow before 5 answers', () => {
    expect(updateWorkingSet(full(8), 8, [a(false), a(false), a(false), a(false)]).size).toBe(8)
  })

  it('narrows at most once per 8 answers and never below 2', () => {
    let ws = full(4)
    const answers: Answer[] = []
    for (let i = 0; i < 12; i++) {
      answers.push(a(false))
      ws = updateWorkingSet(ws, 4, answers)
    }
    expect(ws.size).toBe(2)
    expect(ws.lastNarrowedAtCount).toBe(5)
  })

  it('widens by one after 3 correct in a row, up to the awake count', () => {
    let ws: WorkingSet = { size: 2, widenStreak: 0, lastNarrowedAtCount: -Infinity }
    const answers: Answer[] = []
    for (let i = 0; i < 3; i++) {
      answers.push(a(true))
      ws = updateWorkingSet(ws, 3, answers)
    }
    expect(ws.size).toBe(3)
    expect(ws.widenStreak).toBe(0)
    for (let i = 0; i < 3; i++) {
      answers.push(a(true))
      ws = updateWorkingSet(ws, 3, answers)
    }
    expect(ws.size).toBe(3)
  })

  it('a miss resets the widen streak', () => {
    let ws: WorkingSet = { size: 2, widenStreak: 2, lastNarrowedAtCount: -Infinity }
    ws = updateWorkingSet(ws, 4, [a(true), a(true), a(false)])
    expect(ws.widenStreak).toBe(0)
    expect(ws.size).toBe(2)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/core/engine/workingSet.test.ts
```
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/core/engine/workingSet.ts`**

```ts
import type { Answer } from '../types'
import { accuracy, lastN } from './stats'

export const IDLE_MS = 7 * 24 * 60 * 60 * 1000
export const NARROW_MIN_ANSWERS = 5
export const NARROW_WINDOW = 8
export const NARROW_THRESHOLD = 0.6
export const WIDEN_STREAK = 3
export const MIN_WORKING_SET = 2

export interface WorkingSet {
  size: number
  widenStreak: number
  lastNarrowedAtCount: number
}

export function initialWorkingSet(
  awakeCount: number,
  lastSessionEndedAt: number | null,
  now: number,
): WorkingSet {
  const idle = lastSessionEndedAt !== null && now - lastSessionEndedAt > IDLE_MS
  const size = idle ? Math.max(MIN_WORKING_SET, Math.ceil(awakeCount / 2)) : awakeCount
  return { size: Math.min(size, awakeCount), widenStreak: 0, lastNarrowedAtCount: -Infinity }
}

export function updateWorkingSet(
  ws: WorkingSet,
  awakeCount: number,
  sessionAnswers: readonly Answer[],
): WorkingSet {
  const last = sessionAnswers[sessionAnswers.length - 1]
  let { size, widenStreak, lastNarrowedAtCount } = ws
  size = Math.min(size, awakeCount)

  if (last.correct) {
    widenStreak += 1
    if (widenStreak >= WIDEN_STREAK && size < awakeCount) {
      size += 1
      widenStreak = 0
    }
  } else {
    widenStreak = 0
  }

  const count = sessionAnswers.length
  const windowAccuracy = accuracy(lastN(sessionAnswers, NARROW_WINDOW))
  const cooledDown = count - lastNarrowedAtCount >= NARROW_WINDOW
  if (count >= NARROW_MIN_ANSWERS && windowAccuracy < NARROW_THRESHOLD && cooledDown) {
    size = Math.max(MIN_WORKING_SET, Math.floor(size / 2))
    lastNarrowedAtCount = count
  }

  return { size, widenStreak, lastNarrowedAtCount }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/core/engine/workingSet.test.ts
```
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add working-set narrow/widen rules"
```

---

### Task 7: Pacing policies

**Files:**
- Create: `src/core/engine/pacing/types.ts`, `unlimited.ts`, `eguchi.ts`, `manual.ts`, `index.ts`
- Test: `src/core/engine/pacing/pacing.test.ts`

**Interfaces:**
- Consumes: `Progression`, `PacingParams`, `PacingPolicyId`, `lastN`.
- Produces:
  ```ts
  interface PacingInput { progression: Progression; sessionStreak: number; streakChordIds: ReadonlySet<string>; awakeChordIds: string[]; now: number }
  interface PacingVerdict { ready: boolean; reason: string }
  type PacingPolicy = (input: PacingInput, params: PacingParams) => PacingVerdict
  unlimited, eguchi, manual: PacingPolicy
  DEFAULT_PACING_PARAMS: PacingParams   // { streakTarget: 10, eguchiWindow: 40, eguchiDays: 14, eguchiSessions: 10 }
  PACING_LIMITS: Record<keyof PacingParams, [min, max]>
  clampPacingParams(params): PacingParams
  policyFor(id: PacingPolicyId): PacingPolicy
  ```

- [ ] **Step 1: Write failing test**

`src/core/engine/pacing/pacing.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Answer, Progression, SessionSummary } from '../../types'
import { DEFAULT_PACING_PARAMS, clampPacingParams, policyFor } from './index'
import type { PacingInput } from './types'

const DAY = 24 * 60 * 60 * 1000

function progression(over: Partial<Progression> = {}): Progression {
  return {
    unlocks: [{ chordId: 'red', unlockedAt: 0 }, { chordId: 'yellow', unlockedAt: 0 }],
    napping: null, lastNapChangeAt: 0, streak: 0, bestStreak: 0, heat: 0, chordStats: {},
    recentAnswers: [], sessions: [], stars: 0, readyForUnlock: false, ...over,
  }
}

function input(over: Partial<PacingInput> = {}): PacingInput {
  return {
    progression: progression(), sessionStreak: 0, streakChordIds: new Set(),
    awakeChordIds: ['red', 'yellow'], now: 0, ...over,
  }
}

const answers = (n: number, correct = true): Answer[] =>
  Array.from({ length: n }, (_, i) => ({ chordId: i % 2 ? 'red' : 'yellow', correct, at: i }))

const session = (endedAt: number, countsForPacing = true): SessionSummary => ({
  startedAt: endedAt - 1000, endedAt, count: 20, correct: 20, levelAtStart: 1, stars: 3,
  leveledUp: false, countsForPacing,
})

describe('unlimited', () => {
  const unlimited = policyFor('unlimited')
  it('is ready at the streak target when every awake chord was hit', () => {
    const v = unlimited(
      input({ sessionStreak: 10, streakChordIds: new Set(['red', 'yellow']) }),
      DEFAULT_PACING_PARAMS,
    )
    expect(v.ready).toBe(true)
  })
  it('is not ready below the target', () => {
    const v = unlimited(
      input({ sessionStreak: 9, streakChordIds: new Set(['red', 'yellow']) }),
      DEFAULT_PACING_PARAMS,
    )
    expect(v.ready).toBe(false)
    expect(v.reason).toMatch(/9 of 10/)
  })
  it('is not ready if some awake chord was never in the streak', () => {
    const v = unlimited(
      input({ sessionStreak: 12, streakChordIds: new Set(['red']) }),
      DEFAULT_PACING_PARAMS,
    )
    expect(v.ready).toBe(false)
    expect(v.reason).toMatch(/yellow/)
  })
  it('honours a custom target', () => {
    const v = unlimited(
      input({ sessionStreak: 3, streakChordIds: new Set(['red', 'yellow']) }),
      { ...DEFAULT_PACING_PARAMS, streakTarget: 3 },
    )
    expect(v.ready).toBe(true)
  })
})

describe('eguchi', () => {
  const eguchi = policyFor('eguchi')
  const params = { ...DEFAULT_PACING_PARAMS, eguchiWindow: 4, eguchiDays: 14, eguchiSessions: 2 }
  const ready = progression({
    recentAnswers: answers(4),
    sessions: [session(DAY), session(2 * DAY)],
  })

  it('is ready with perfect window, enough days, and enough counted sessions', () => {
    expect(eguchi(input({ progression: ready, now: 15 * DAY }), params).ready).toBe(true)
  })
  it('blocks on a single miss in the window', () => {
    const p = { ...ready, recentAnswers: [...answers(3), { chordId: 'red', correct: false, at: 9 }] }
    const v = eguchi(input({ progression: p, now: 15 * DAY }), params)
    expect(v.ready).toBe(false)
    expect(v.reason).toMatch(/accuracy/)
  })
  it('blocks when the window is not yet full', () => {
    const p = { ...ready, recentAnswers: answers(3) }
    expect(eguchi(input({ progression: p, now: 15 * DAY }), params).ready).toBe(false)
  })
  it('blocks before enough days since the last unlock', () => {
    const v = eguchi(input({ progression: ready, now: 13 * DAY }), params)
    expect(v.ready).toBe(false)
    expect(v.reason).toMatch(/day/)
  })
  it('counts only sessions that count for pacing and happened after the last unlock', () => {
    const p = {
      ...ready,
      unlocks: [{ chordId: 'red', unlockedAt: 0 }, { chordId: 'yellow', unlockedAt: 1.5 * DAY }],
      sessions: [session(DAY), session(2 * DAY), session(3 * DAY, false)],
    }
    const v = eguchi(input({ progression: p, now: 20 * DAY }), params)
    expect(v.ready).toBe(false)
    expect(v.reason).toMatch(/session/)
  })
  it('zero days and zero sessions collapse to the accuracy rule alone', () => {
    const p = progression({ recentAnswers: answers(4) })
    const v = eguchi(input({ progression: p, now: 0 }), { ...params, eguchiDays: 0, eguchiSessions: 0 })
    expect(v.ready).toBe(true)
  })
})

describe('manual', () => {
  it('is never ready', () => {
    const v = policyFor('manual')(
      input({ sessionStreak: 50, streakChordIds: new Set(['red', 'yellow']) }),
      DEFAULT_PACING_PARAMS,
    )
    expect(v.ready).toBe(false)
  })
})

describe('clampPacingParams', () => {
  it('clamps to the spec ranges', () => {
    expect(clampPacingParams({ streakTarget: 1, eguchiWindow: 999, eguchiDays: -3, eguchiSessions: 500 }))
      .toEqual({ streakTarget: 3, eguchiWindow: 200, eguchiDays: 0, eguchiSessions: 100 })
    expect(clampPacingParams(DEFAULT_PACING_PARAMS)).toEqual(DEFAULT_PACING_PARAMS)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/core/engine/pacing
```
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/core/engine/pacing/types.ts`:
```ts
import type { PacingParams, Progression } from '../../types'

export interface PacingInput {
  progression: Progression
  sessionStreak: number
  /** Chords answered correctly within the current streak. */
  streakChordIds: ReadonlySet<string>
  awakeChordIds: string[]
  now: number
}

export interface PacingVerdict {
  ready: boolean
  reason: string
}

export type PacingPolicy = (input: PacingInput, params: PacingParams) => PacingVerdict
```

`src/core/engine/pacing/unlimited.ts`:
```ts
import type { PacingPolicy } from './types'

export const unlimited: PacingPolicy = (input, params) => {
  if (input.sessionStreak < params.streakTarget) {
    return { ready: false, reason: `streak ${input.sessionStreak} of ${params.streakTarget}` }
  }
  const missing = input.awakeChordIds.filter((id) => !input.streakChordIds.has(id))
  if (missing.length > 0) {
    return { ready: false, reason: `not yet correct in this streak: ${missing.join(', ')}` }
  }
  return { ready: true, reason: `streak of ${input.sessionStreak}` }
}
```

`src/core/engine/pacing/eguchi.ts`:
```ts
import { lastN } from '../stats'
import type { PacingPolicy } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

export const eguchi: PacingPolicy = (input, params) => {
  const { progression, now } = input
  const window = lastN(progression.recentAnswers, params.eguchiWindow)
  const misses = window.filter((a) => !a.correct).length
  if (window.length < params.eguchiWindow || misses > 0) {
    return {
      ready: false,
      reason: `accuracy: ${window.length - misses}/${params.eguchiWindow} correct in window`,
    }
  }

  const lastUnlockAt = Math.max(...progression.unlocks.map((u) => u.unlockedAt))
  const days = (now - lastUnlockAt) / DAY_MS
  if (days < params.eguchiDays) {
    return { ready: false, reason: `${Math.floor(days)} of ${params.eguchiDays} days since last unlock` }
  }

  const sessionsSince = progression.sessions.filter(
    (s) => s.countsForPacing && s.endedAt > lastUnlockAt,
  ).length
  if (sessionsSince < params.eguchiSessions) {
    return { ready: false, reason: `${sessionsSince} of ${params.eguchiSessions} sessions since last unlock` }
  }

  return { ready: true, reason: 'perfect window, spacing and sessions met' }
}
```

`src/core/engine/pacing/manual.ts`:
```ts
import type { PacingPolicy } from './types'

export const manual: PacingPolicy = () => ({ ready: false, reason: 'manual: parent unlocks' })
```

`src/core/engine/pacing/index.ts`:
```ts
import type { PacingParams, PacingPolicyId } from '../../types'
import { eguchi } from './eguchi'
import { manual } from './manual'
import type { PacingPolicy } from './types'
import { unlimited } from './unlimited'

export type { PacingInput, PacingPolicy, PacingVerdict } from './types'
export { eguchi, manual, unlimited }

export const DEFAULT_PACING_PARAMS: PacingParams = {
  streakTarget: 10,
  eguchiWindow: 40,
  eguchiDays: 14,
  eguchiSessions: 10,
}

export const PACING_LIMITS: Record<keyof PacingParams, [number, number]> = {
  streakTarget: [3, 50],
  eguchiWindow: [10, 200],
  eguchiDays: [0, 60],
  eguchiSessions: [0, 100],
}

export function clampPacingParams(params: PacingParams): PacingParams {
  const out = { ...params }
  for (const key of Object.keys(PACING_LIMITS) as (keyof PacingParams)[]) {
    const [min, max] = PACING_LIMITS[key]
    out[key] = Math.min(max, Math.max(min, Math.round(params[key])))
  }
  return out
}

const POLICIES: Record<PacingPolicyId, PacingPolicy> = { unlimited, eguchi, manual }

export function policyFor(id: PacingPolicyId): PacingPolicy {
  return POLICIES[id]
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/core/engine/pacing
```
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add unlimited, Eguchi and manual pacing policies"
```

---

### Task 8: Nap and wake rules

**Files:**
- Create: `src/core/engine/nap.ts`
- Test: `src/core/engine/nap.test.ts`

**Interfaces:**
- Consumes: `Progression`, `SessionSummary`.
- Produces: `shouldNap(progression): boolean`, `shouldWake(progression, sessionStreak): boolean`, `NAP_ACCURACY = 0.7`, `NAP_SESSIONS = 2`, `WAKE_STREAK = 5`, `MIN_AWAKE = 2`.

`shouldNap` is evaluated after a session summary has been appended. It looks only at counted sessions that ended after `lastNapChangeAt`.

- [ ] **Step 1: Write failing test**

`src/core/engine/nap.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Progression, SessionSummary } from '../types'
import { shouldNap, shouldWake } from './nap'

const s = (endedAt: number, correct: number, countsForPacing = true): SessionSummary => ({
  startedAt: endedAt - 1, endedAt, count: 20, correct, levelAtStart: 2, stars: 1,
  leveledUp: false, countsForPacing,
})

function p(sessions: SessionSummary[], over: Partial<Progression> = {}): Progression {
  return {
    unlocks: ['red', 'yellow', 'blue'].map((chordId) => ({ chordId, unlockedAt: 0 })),
    napping: null, lastNapChangeAt: 0, streak: 0, bestStreak: 0, heat: 0, chordStats: {},
    recentAnswers: [], sessions, stars: 0, readyForUnlock: false, ...over,
  }
}

describe('shouldNap', () => {
  it('naps after two consecutive counted sessions under 70%', () => {
    expect(shouldNap(p([s(1, 13), s(2, 12)]))).toBe(true)
  })
  it('does not nap when the latest session is fine', () => {
    expect(shouldNap(p([s(1, 10), s(2, 19)]))).toBe(false)
  })
  it('exactly 70% is not under', () => {
    expect(shouldNap(p([s(1, 14), s(2, 14)]))).toBe(false)
  })
  it('ignores sessions that do not count and sessions before lastNapChangeAt', () => {
    expect(shouldNap(p([s(1, 5), s(2, 5, false)]))).toBe(false)
    expect(shouldNap(p([s(1, 5), s(2, 5)], { lastNapChangeAt: 1 }))).toBe(false)
  })
  it('never naps when only two chords are unlocked or one is already napping', () => {
    const two = p([s(1, 5), s(2, 5)], {
      unlocks: [{ chordId: 'red', unlockedAt: 0 }, { chordId: 'yellow', unlockedAt: 0 }],
    })
    expect(shouldNap(two)).toBe(false)
    expect(shouldNap(p([s(1, 5), s(2, 5)], { napping: 'blue' }))).toBe(false)
  })
})

describe('shouldWake', () => {
  it('wakes a napping chord at an in-session streak of 5', () => {
    expect(shouldWake(p([], { napping: 'blue' }), 5)).toBe(true)
    expect(shouldWake(p([], { napping: 'blue' }), 4)).toBe(false)
    expect(shouldWake(p([]), 50)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/core/engine/nap.test.ts
```

- [ ] **Step 3: Implement `src/core/engine/nap.ts`**

```ts
import type { Progression } from '../types'
import { lastN } from './stats'

export const NAP_ACCURACY = 0.7
export const NAP_SESSIONS = 2
export const WAKE_STREAK = 5
export const MIN_AWAKE = 2

export function shouldNap(progression: Progression): boolean {
  if (progression.napping !== null) return false
  if (progression.unlocks.length - 1 < MIN_AWAKE) return false
  const eligible = progression.sessions.filter(
    (s) => s.countsForPacing && s.endedAt > progression.lastNapChangeAt,
  )
  const recent = lastN(eligible, NAP_SESSIONS)
  if (recent.length < NAP_SESSIONS) return false
  return recent.every((s) => s.correct / s.count < NAP_ACCURACY)
}

export function shouldWake(progression: Progression, sessionStreak: number): boolean {
  return progression.napping !== null && sessionStreak >= WAKE_STREAK
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/core/engine/nap.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add nap and wake rules"
```

---

### Task 9: Session engine

**Files:**
- Create: `src/core/engine/events.ts`, `src/core/engine/session.ts`, `src/core/testing/fixtures.ts`
- Test: `src/core/engine/session.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–8.
- Produces:
  ```ts
  // events.ts
  type EngineEvent =
    | { type: 'sessionStarted'; workingSetSize: number }
    | { type: 'questionAsked'; chordId: string }
    | { type: 'answered'; chordId: string; chosenId: string; correct: boolean; streak: number; heat: number }
    | { type: 'streakMilestone'; streak: number }
    | { type: 'workingSetChanged'; size: number }
    | { type: 'chordWoken'; chordId: string }
    | { type: 'readyForUnlock' }
    | { type: 'levelUp'; chordId: string; level: number }
    | { type: 'chordNapped'; chordId: string }
    | { type: 'sessionComplete'; summary: SessionSummary }

  // session.ts
  type SessionPhase = 'question' | 'feedback' | 'levelUp' | 'summary'
  interface SessionState {
    startedAt: number; target: number; levelAtStart: number; answers: Answer[]
    currentChordId: string | null; lastAskedId: string | null; workingSet: WorkingSet
    streakChordIds: string[]; phase: SessionPhase; pendingLevelUp: string | null
    leveledUp: boolean; summary: SessionSummary | null
  }
  interface EngineDeps { now: number; rng: Rng }
  interface EngineResult { session: SessionState; progression: Progression; events: EngineEvent[] }
  startSession(profile, deps): EngineResult
  answer(profile, session, chosenId, deps): EngineResult      // question -> feedback
  advance(profile, session, deps): EngineResult               // feedback -> levelUp | question | summary
  continueAfterLevelUp(profile, session, deps): EngineResult  // levelUp -> question | summary
  endSession(profile, session, deps): EngineResult            // any -> summary
  workingSetIds(profile.progression, session): string[]

  // testing/fixtures.ts
  makeProgression(over?: Partial<Progression>): Progression   // red+yellow unlocked at 0
  makeProfile(over?: { settings?: Partial<ProfileSettings>; progression?: Partial<Progression> }): Profile
  ```
- Every function is pure: it never mutates its inputs. `profile.progression` is the input progression; callers store the returned one.

- [ ] **Step 1: Write fixtures and events**

`src/core/testing/fixtures.ts`:
```ts
import { DEFAULT_INSTRUMENT_ID } from '../content/instruments'
import { DEFAULT_PACING_PARAMS } from '../engine/pacing'
import type { Profile, ProfileSettings, Progression } from '../types'

export function makeProgression(over: Partial<Progression> = {}): Progression {
  return {
    unlocks: [
      { chordId: 'red', unlockedAt: 0 },
      { chordId: 'yellow', unlockedAt: 0 },
    ],
    napping: null,
    lastNapChangeAt: 0,
    streak: 0,
    bestStreak: 0,
    heat: 0,
    chordStats: {},
    recentAnswers: [],
    sessions: [],
    stars: 0,
    readyForUnlock: false,
    ...over,
  }
}

export const DEFAULT_TEST_SETTINGS: ProfileSettings = {
  pacing: 'unlimited',
  pacingParams: DEFAULT_PACING_PARAMS,
  instrumentId: DEFAULT_INSTRUMENT_ID,
  sessionTarget: 20,
  showLetters: false,
  intensity: 'full',
  celebrationSound: true,
  haptics: true,
}

export function makeProfile(
  over: { settings?: Partial<ProfileSettings>; progression?: Partial<Progression> } = {},
): Profile {
  return {
    id: 'p1',
    name: 'Test Kid',
    avatarEmoji: '🐱',
    createdAt: 0,
    settings: { ...DEFAULT_TEST_SETTINGS, ...over.settings },
    progression: makeProgression(over.progression),
  }
}
```

`src/core/engine/events.ts`:
```ts
import type { SessionSummary } from '../types'

export type EngineEvent =
  | { type: 'sessionStarted'; workingSetSize: number }
  | { type: 'questionAsked'; chordId: string }
  | {
      type: 'answered'
      chordId: string
      chosenId: string
      correct: boolean
      streak: number
      heat: number
    }
  | { type: 'streakMilestone'; streak: number }
  | { type: 'workingSetChanged'; size: number }
  | { type: 'chordWoken'; chordId: string }
  | { type: 'readyForUnlock' }
  | { type: 'levelUp'; chordId: string; level: number }
  | { type: 'chordNapped'; chordId: string }
  | { type: 'sessionComplete'; summary: SessionSummary }
```

- [ ] **Step 2: Write the failing session tests**

`src/core/engine/session.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_CURRICULUM } from '../content/curriculum'
import { makeProfile } from '../testing/fixtures'
import type { Profile, SessionSummary } from '../types'
import type { EngineEvent } from './events'
import { mulberry32 } from './rng'
import {
  advance, answer, continueAfterLevelUp, endSession, startSession, type EngineDeps,
  type EngineResult, type SessionState, workingSetIds,
} from './session'

const DAY = 24 * 60 * 60 * 1000
// One RNG stream for the whole file so consecutive questions vary.
const rng = mulberry32(11)
const deps = (now = 1000): EngineDeps => ({ now, rng })
const types = (events: EngineEvent[]) => events.map((e) => e.type)

function withProgression(profile: Profile, r: EngineResult): Profile {
  return { ...profile, progression: r.progression }
}

/** Answer the current question correctly (or not) and advance past feedback. */
function play(profile: Profile, session: SessionState, correct: boolean, now: number) {
  const chosen = correct ? session.currentChordId! : otherThan(session.currentChordId!, profile, session)
  const a = answer(profile, session, chosen, deps(now))
  let p = withProgression(profile, a)
  const adv = advance(p, a.session, deps(now))
  p = withProgression(p, adv)
  return { profile: p, session: adv.session, events: [...a.events, ...adv.events] }
}

function otherThan(id: string, profile: Profile, session: SessionState): string {
  return workingSetIds(profile.progression, session).find((x) => x !== id)!
}

const weakSession = (endedAt: number): SessionSummary => ({
  startedAt: endedAt - 1, endedAt, count: 20, correct: 8, levelAtStart: 2, stars: 1,
  leveledUp: false, countsForPacing: true,
})

describe('startSession', () => {
  it('starts cold with a full working set and asks a question', () => {
    const profile = makeProfile({ progression: { streak: 7, heat: 0.5 } })
    const r = startSession(profile, deps())
    expect(r.progression.streak).toBe(0)
    expect(r.progression.heat).toBe(0)
    expect(r.session.phase).toBe('question')
    expect(r.session.workingSet.size).toBe(2)
    expect(['red', 'yellow']).toContain(r.session.currentChordId)
    expect(types(r.events)).toEqual(['sessionStarted', 'questionAsked'])
    expect(r.session.target).toBe(20)
    expect(r.session.levelAtStart).toBe(1)
  })

  it('narrows the working set after a week idle', () => {
    const unlocks = DEFAULT_CURRICULUM.slice(0, 6).map((chordId) => ({ chordId, unlockedAt: 0 }))
    const profile = makeProfile({
      progression: { unlocks, sessions: [weakSession(0)] },
    })
    const r = startSession(profile, deps(8 * DAY))
    expect(r.session.workingSet.size).toBe(3)
    expect(workingSetIds(r.progression, r.session)).toEqual(['red', 'yellow', 'blue'])
  })

  it('excludes a napping chord from the working set', () => {
    const unlocks = DEFAULT_CURRICULUM.slice(0, 3).map((chordId) => ({ chordId, unlockedAt: 0 }))
    const r = startSession(makeProfile({ progression: { unlocks, napping: 'blue' } }), deps())
    expect(workingSetIds(r.progression, r.session)).toEqual(['red', 'yellow'])
  })
})

describe('answer and advance', () => {
  it('records a correct answer, raises streak and heat, then asks the next question', () => {
    let profile = makeProfile()
    const start = startSession(profile, deps())
    profile = withProgression(profile, start)
    const asked = start.session.currentChordId!
    const a = answer(profile, start.session, asked, deps(2000))
    expect(a.session.phase).toBe('feedback')
    expect(a.progression.streak).toBe(1)
    expect(a.progression.bestStreak).toBe(1)
    expect(a.progression.heat).toBeCloseTo(1 / 15)
    expect(a.progression.chordStats[asked]).toEqual({ attempts: 1, correct: 1 })
    expect(a.progression.recentAnswers).toEqual([{ chordId: asked, correct: true, at: 2000 }])
    expect(a.session.streakChordIds).toEqual([asked])
    expect(a.events).toEqual([
      { type: 'answered', chordId: asked, chosenId: asked, correct: true, streak: 1, heat: 1 / 15 },
    ])
    const adv = advance(withProgression(profile, a), a.session, deps(2500))
    expect(adv.session.phase).toBe('question')
    expect(adv.session.answers).toHaveLength(1)
    expect(types(adv.events)).toEqual(['questionAsked'])
  })

  it('a wrong answer resets streak and heat and clears the streak chord set', () => {
    let profile = makeProfile()
    const start = startSession(profile, deps())
    profile = withProgression(profile, start)
    const first = play(profile, start.session, true, 2000)
    const asked = first.session.currentChordId!
    const wrong = otherThan(asked, first.profile, first.session)
    const a = answer(first.profile, first.session, wrong, deps(3000))
    expect(a.progression.streak).toBe(0)
    expect(a.progression.heat).toBe(0)
    expect(a.progression.bestStreak).toBe(1)
    expect(a.session.streakChordIds).toEqual([])
    expect(a.progression.recentAnswers.at(-1)).toEqual({ chordId: asked, correct: false, at: 3000 })
    expect(a.events[0]).toMatchObject({ type: 'answered', correct: false, chosenId: wrong })
  })

  it('awards a star at every streak milestone of 5', () => {
    let profile = makeProfile({ settings: { pacing: 'manual' } })
    const start = startSession(profile, deps())
    let session = start.session
    profile = withProgression(profile, start)
    const seen: EngineEvent[] = []
    for (let i = 0; i < 5; i++) {
      const r = play(profile, session, true, 2000 + i)
      profile = r.profile
      session = r.session
      seen.push(...r.events)
    }
    expect(seen.filter((e) => e.type === 'streakMilestone')).toEqual([{ type: 'streakMilestone', streak: 5 }])
    expect(profile.progression.stars).toBe(1)
  })

  it('ignores answers outside the question phase', () => {
    const profile = makeProfile()
    const start = startSession(profile, deps())
    const a = answer(profile, start.session, start.session.currentChordId!, deps())
    const again = answer(withProgression(profile, a), a.session, 'red', deps())
    expect(again.events).toEqual([])
    expect(again.session).toBe(a.session)
  })
})

describe('level up', () => {
  function runUntilLevelUp(profile: Profile, maxAnswers = 30) {
    const start = startSession(profile, deps())
    profile = withProgression(profile, start)
    let session = start.session
    const events: EngineEvent[] = [...start.events]
    while (
      session.phase !== 'levelUp' &&
      session.phase !== 'summary' &&
      session.answers.length < maxAnswers
    ) {
      const r = play(profile, session, true, 2000 + session.answers.length)
      profile = r.profile
      session = r.session
      events.push(...r.events)
    }
    return { profile, session, events }
  }

  it('unlocks the next chord mid-session at a streak of 10 covering every awake chord', () => {
    const { profile, session, events } = runUntilLevelUp(makeProfile())
    expect(session.phase).toBe('levelUp')
    expect(session.answers.length).toBeGreaterThanOrEqual(10)
    expect(session.answers.length).toBeLessThanOrEqual(14)
    expect(events.filter((e) => e.type === 'levelUp')).toEqual([{ type: 'levelUp', chordId: 'blue', level: 2 }])
    expect(profile.progression.unlocks.map((u) => u.chordId)).toEqual(['red', 'yellow', 'blue'])
    expect(profile.progression.unlocks[2].unlockedAt).toBe(2000 + session.answers.length - 1)
    expect(profile.progression.streak).toBe(0)
    expect(profile.progression.heat).toBe(0)
    expect(session.leveledUp).toBe(true)
    expect(session.workingSet.size).toBe(3)

    const cont = continueAfterLevelUp(profile, session, deps(5000))
    expect(cont.session.phase).toBe('question')
    expect(types(cont.events)).toEqual(['questionAsked'])
    expect(workingSetIds(cont.progression, cont.session)).toEqual(['red', 'yellow', 'blue'])
  })

  it('finishes the session instead if the target was reached at the level-up', () => {
    const { profile, session } = runUntilLevelUp(makeProfile({ settings: { sessionTarget: 10 } }))
    expect(session.phase).toBe('levelUp')
    const cont = continueAfterLevelUp(profile, session, deps(5000))
    expect(cont.session.phase).toBe('summary')
    expect(cont.session.summary?.leveledUp).toBe(true)
  })

  it('does not unlock under the Eguchi policy when the window is not full', () => {
    const { session, events } = runUntilLevelUp(makeProfile({ settings: { pacing: 'eguchi' } }))
    expect(session.phase).not.toBe('levelUp')
    expect(types(events)).not.toContain('levelUp')
  })

  it('under manual pacing flags readiness once instead of unlocking', () => {
    const { profile, session, events } = runUntilLevelUp(makeProfile({ settings: { pacing: 'manual' } }))
    expect(session.phase).not.toBe('levelUp')
    expect(events.filter((e) => e.type === 'readyForUnlock')).toHaveLength(1)
    expect(profile.progression.readyForUnlock).toBe(true)
  })

  it('never consults pacing once every chord is unlocked', () => {
    const unlocks = DEFAULT_CURRICULUM.map((chordId) => ({ chordId, unlockedAt: 0 }))
    const { session, events } = runUntilLevelUp(
      makeProfile({ settings: { pacingParams: { streakTarget: 3, eguchiWindow: 40, eguchiDays: 14, eguchiSessions: 10 } }, progression: { unlocks } }),
      60,
    )
    expect(session.phase).not.toBe('levelUp')
    expect(types(events)).not.toContain('levelUp')
  })
})

describe('endSession', () => {
  function playN(profile: Profile, n: number, correct: (i: number) => boolean) {
    const start = startSession(profile, deps())
    profile = withProgression(profile, start)
    let session = start.session
    const events: EngineEvent[] = []
    for (let i = 0; i < n; i++) {
      const r = play(profile, session, correct(i), 2000 + i)
      profile = r.profile
      session = r.session
      events.push(...r.events)
    }
    return { profile, session, events }
  }

  it('completes at the target with a counted summary and stars', () => {
    const { profile, session, events } = playN(makeProfile({ settings: { pacing: 'manual' } }), 20, (i) => i !== 3)
    expect(session.phase).toBe('summary')
    const complete = events.find((e) => e.type === 'sessionComplete')!
    expect(complete).toMatchObject({
      type: 'sessionComplete',
      summary: { count: 20, correct: 19, stars: 3, countsForPacing: true, levelAtStart: 1, leveledUp: false },
    })
    expect(profile.progression.sessions).toHaveLength(1)
    expect(profile.progression.stars).toBe(3 + 3)
  })

  it('an early exit under half the target does not count for pacing', () => {
    const r = playN(makeProfile(), 5, () => true)
    const end = endSession(r.profile, r.session, deps(9000))
    expect(end.session.phase).toBe('summary')
    expect(end.session.summary).toMatchObject({ count: 5, correct: 5, countsForPacing: false, stars: 3, endedAt: 9000 })
    expect(end.progression.sessions).toHaveLength(1)
  })

  it('an exit with no answers records nothing', () => {
    const profile = makeProfile()
    const start = startSession(profile, deps())
    const end = endSession(withProgression(profile, start), start.session, deps())
    expect(end.progression.sessions).toHaveLength(0)
    expect(end.session.summary?.stars).toBe(0)
    expect(types(end.events)).toEqual(['sessionComplete'])
  })

  it('ending twice is a no-op', () => {
    const r = playN(makeProfile(), 2, () => true)
    const end = endSession(r.profile, r.session, deps())
    const twice = endSession(withProgression(r.profile, end), end.session, deps())
    expect(twice.events).toEqual([])
    expect(twice.session).toBe(end.session)
  })

  it('naps the newest chord after a second consecutive weak session', () => {
    const unlocks = DEFAULT_CURRICULUM.slice(0, 3).map((chordId) => ({ chordId, unlockedAt: 0 }))
    const profile = makeProfile({ progression: { unlocks, sessions: [weakSession(500)] } })
    const { profile: after, events } = playN(profile, 20, (i) => i % 3 === 0)
    expect(after.progression.napping).toBe('blue')
    expect(after.progression.lastNapChangeAt).toBe(2019)
    expect(events.filter((e) => e.type === 'chordNapped')).toEqual([{ type: 'chordNapped', chordId: 'blue' }])
    const next = startSession(after, deps(3000))
    expect(workingSetIds(next.progression, next.session)).toEqual(['red', 'yellow'])
  })
})

describe('wake', () => {
  it('wakes the napping chord after 5 correct in a row and widens the working set', () => {
    const unlocks = DEFAULT_CURRICULUM.slice(0, 3).map((chordId) => ({ chordId, unlockedAt: 0 }))
    let profile = makeProfile({ settings: { pacing: 'manual' }, progression: { unlocks, napping: 'blue' } })
    const start = startSession(profile, deps())
    profile = withProgression(profile, start)
    let session = start.session
    const events: EngineEvent[] = []
    for (let i = 0; i < 5; i++) {
      const r = play(profile, session, true, 2000 + i)
      profile = r.profile
      session = r.session
      events.push(...r.events)
    }
    expect(profile.progression.napping).toBeNull()
    expect(profile.progression.lastNapChangeAt).toBe(2004)
    expect(events.filter((e) => e.type === 'chordWoken')).toEqual([{ type: 'chordWoken', chordId: 'blue' }])
    expect(workingSetIds(profile.progression, session)).toEqual(['red', 'yellow', 'blue'])
  })
})
```

- [ ] **Step 3: Run to verify it fails**

```bash
npx vitest run src/core/engine/session.test.ts
```
Expected: FAIL, `./session` not found.

- [ ] **Step 4: Implement `src/core/engine/session.ts`**

```ts
import { awakeChordIds, isChampion, levelOf, newestUnlockedId, nextChordId } from '../content/curriculum'
import { RECENT_ANSWERS_CAP, type Answer, type Profile, type Progression, type SessionSummary } from '../types'
import type { EngineEvent } from './events'
import { shouldNap, shouldWake } from './nap'
import { policyFor, unlimited } from './pacing'
import type { Rng } from './rng'
import { pickChord } from './selection'
import { MILESTONE_EVERY, heatFor, starsFor } from './stats'
import { initialWorkingSet, updateWorkingSet, type WorkingSet } from './workingSet'

export type SessionPhase = 'question' | 'feedback' | 'levelUp' | 'summary'

export interface SessionState {
  startedAt: number
  target: number
  levelAtStart: number
  answers: Answer[]
  currentChordId: string | null
  lastAskedId: string | null
  workingSet: WorkingSet
  streakChordIds: string[]
  phase: SessionPhase
  pendingLevelUp: string | null
  leveledUp: boolean
  summary: SessionSummary | null
}

export interface EngineDeps {
  now: number
  rng: Rng
}

export interface EngineResult {
  session: SessionState
  progression: Progression
  events: EngineEvent[]
}

export function workingSetIds(progression: Progression, session: SessionState): string[] {
  return awakeChordIds(progression).slice(0, session.workingSet.size)
}

function unchanged(profile: Profile, session: SessionState): EngineResult {
  return { session, progression: profile.progression, events: [] }
}

function ask(progression: Progression, session: SessionState, rng: Rng): { session: SessionState; event: EngineEvent } {
  const chordId = pickChord(
    {
      workingSet: workingSetIds(progression, session),
      recentAnswers: progression.recentAnswers,
      lastAskedId: session.lastAskedId,
      newestChordId: newestUnlockedId(progression.unlocks),
    },
    rng,
  )
  return {
    session: { ...session, currentChordId: chordId, lastAskedId: chordId, phase: 'question' },
    event: { type: 'questionAsked', chordId },
  }
}

export function startSession(profile: Profile, deps: EngineDeps): EngineResult {
  const progression: Progression = { ...profile.progression, streak: 0, heat: 0 }
  const awake = awakeChordIds(progression)
  const last = progression.sessions[progression.sessions.length - 1]
  const workingSet = initialWorkingSet(awake.length, last ? last.endedAt : null, deps.now)
  const base: SessionState = {
    startedAt: deps.now,
    target: profile.settings.sessionTarget,
    levelAtStart: levelOf(progression.unlocks),
    answers: [],
    currentChordId: null,
    lastAskedId: null,
    workingSet,
    streakChordIds: [],
    phase: 'question',
    pendingLevelUp: null,
    leveledUp: false,
    summary: null,
  }
  const asked = ask(progression, base, deps.rng)
  return {
    session: asked.session,
    progression,
    events: [{ type: 'sessionStarted', workingSetSize: workingSet.size }, asked.event],
  }
}

export function answer(profile: Profile, session: SessionState, chosenId: string, deps: EngineDeps): EngineResult {
  if (session.phase !== 'question' || session.currentChordId === null) return unchanged(profile, session)
  const chordId = session.currentChordId
  const correct = chosenId === chordId
  const events: EngineEvent[] = []
  const record: Answer = { chordId, correct, at: deps.now }

  const stat = profile.progression.chordStats[chordId] ?? { attempts: 0, correct: 0 }
  const streak = correct ? profile.progression.streak + 1 : 0
  let progression: Progression = {
    ...profile.progression,
    chordStats: {
      ...profile.progression.chordStats,
      [chordId]: { attempts: stat.attempts + 1, correct: stat.correct + (correct ? 1 : 0) },
    },
    recentAnswers: [...profile.progression.recentAnswers, record].slice(-RECENT_ANSWERS_CAP),
    streak,
    bestStreak: Math.max(profile.progression.bestStreak, streak),
    heat: heatFor(streak),
  }
  let next: SessionState = {
    ...session,
    answers: [...session.answers, record],
    streakChordIds: correct ? Array.from(new Set([...session.streakChordIds, chordId])) : [],
    phase: 'feedback',
  }
  events.push({ type: 'answered', chordId, chosenId, correct, streak, heat: progression.heat })

  if (correct && streak % MILESTONE_EVERY === 0) {
    progression = { ...progression, stars: progression.stars + 1 }
    events.push({ type: 'streakMilestone', streak })
  }

  let awake = awakeChordIds(progression)
  let workingSet = updateWorkingSet(session.workingSet, awake.length, next.answers)

  if (shouldWake(progression, streak)) {
    const woken = progression.napping!
    progression = { ...progression, napping: null, lastNapChangeAt: deps.now }
    awake = awakeChordIds(progression)
    workingSet = { ...workingSet, size: awake.length }
    events.push({ type: 'chordWoken', chordId: woken })
  }

  if (workingSet.size !== session.workingSet.size) {
    events.push({ type: 'workingSetChanged', size: workingSet.size })
  }
  next = { ...next, workingSet }

  if (progression.napping === null && !isChampion(progression)) {
    const input = {
      progression,
      sessionStreak: streak,
      streakChordIds: new Set(next.streakChordIds),
      awakeChordIds: awake,
      now: deps.now,
    }
    const params = profile.settings.pacingParams
    if (policyFor(profile.settings.pacing)(input, params).ready) {
      next = { ...next, pendingLevelUp: nextChordId(progression.unlocks) }
    } else if (
      profile.settings.pacing === 'manual' &&
      !progression.readyForUnlock &&
      unlimited(input, params).ready
    ) {
      progression = { ...progression, readyForUnlock: true }
      events.push({ type: 'readyForUnlock' })
    }
  }

  return { session: next, progression, events }
}

export function advance(profile: Profile, session: SessionState, deps: EngineDeps): EngineResult {
  if (session.phase !== 'feedback') return unchanged(profile, session)

  if (session.pendingLevelUp) {
    const chordId = session.pendingLevelUp
    const progression: Progression = {
      ...profile.progression,
      unlocks: [...profile.progression.unlocks, { chordId, unlockedAt: deps.now }],
      streak: 0,
      heat: 0,
      lastNapChangeAt: deps.now,
      readyForUnlock: false,
    }
    const awake = awakeChordIds(progression)
    const next: SessionState = {
      ...session,
      phase: 'levelUp',
      pendingLevelUp: null,
      leveledUp: true,
      streakChordIds: [],
      workingSet: { ...session.workingSet, size: awake.length },
    }
    return {
      session: next,
      progression,
      events: [{ type: 'levelUp', chordId, level: levelOf(progression.unlocks) }],
    }
  }

  if (session.answers.length >= session.target) return endSession(profile, session, deps)

  const asked = ask(profile.progression, session, deps.rng)
  return { session: asked.session, progression: profile.progression, events: [asked.event] }
}

export function continueAfterLevelUp(profile: Profile, session: SessionState, deps: EngineDeps): EngineResult {
  if (session.phase !== 'levelUp') return unchanged(profile, session)
  if (session.answers.length >= session.target) return endSession(profile, session, deps)
  const asked = ask(profile.progression, session, deps.rng)
  return { session: asked.session, progression: profile.progression, events: [asked.event] }
}

export function endSession(profile: Profile, session: SessionState, deps: EngineDeps): EngineResult {
  if (session.phase === 'summary') return unchanged(profile, session)
  const count = session.answers.length
  const correct = session.answers.filter((a) => a.correct).length
  const summary: SessionSummary = {
    startedAt: session.startedAt,
    endedAt: deps.now,
    count,
    correct,
    levelAtStart: session.levelAtStart,
    stars: count > 0 ? starsFor(correct, count) : 0,
    leveledUp: session.leveledUp,
    countsForPacing: count >= Math.ceil(session.target / 2),
  }
  const events: EngineEvent[] = []
  let progression = profile.progression
  if (count > 0) {
    progression = {
      ...progression,
      sessions: [...progression.sessions, summary],
      stars: progression.stars + summary.stars,
    }
    if (shouldNap(progression)) {
      const chordId = newestUnlockedId(progression.unlocks)
      progression = { ...progression, napping: chordId, lastNapChangeAt: deps.now }
      events.push({ type: 'chordNapped', chordId })
    }
  }
  events.push({ type: 'sessionComplete', summary })
  return {
    session: { ...session, phase: 'summary', currentChordId: null, summary },
    progression,
    events,
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/core/engine/session.test.ts
```
Expected: PASS (17 tests). If the level-up test's `answers.length <= 14` bound fails because the seeded RNG never alternated chords, change the seed in `deps()` rather than the bound; the `REPEAT_FACTOR` of 0.3 makes alternation very likely within 10 answers.

Note on the nap test: `lastNapChangeAt` equals the `now` of the final `advance` call, which is `2000 + 19 = 2019`.

- [ ] **Step 6: Run the whole core suite and typecheck**

```bash
npm run typecheck && npx vitest run src/core
```
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add pure session engine with events, level-up, nap and wake"
```

---

### Task 10: Profile factory, event bus, safe storage, migrations

**Files:**
- Create: `src/state/profile.ts`, `src/state/eventBus.ts`, `src/state/storage.ts`, `src/state/migrations.ts`
- Test: `src/state/profile.test.ts`, `src/state/eventBus.test.ts`, `src/state/storage.test.ts`, `src/state/migrations.test.ts`

**Interfaces:**
- Produces (profile.ts): `DEFAULT_SETTINGS: ProfileSettings`, `SESSION_TARGET_LIMITS: [10, 50]`, `newProfile(name, avatarEmoji, now, id): Profile`, `clampSettings(settings: ProfileSettings): ProfileSettings`.
- Produces (eventBus.ts): `onEngineEvent(listener: (e: EngineEvent) => void): () => void`, `emitEngineEvents(events: EngineEvent[]): void`.
- Produces (storage.ts): `STORAGE_KEY = 'ear-trainer'`, `BACKUP_KEY = 'ear-trainer.backup'`, `createSafeStorage(backing: Storage): SafeStorage` where `interface SafeStorage extends StateStorage { corrupted: boolean; writeFailed: boolean }` (`StateStorage` from `zustand/middleware`), `createMemoryStorage(): Storage`.
- Produces (migrations.ts): `PERSIST_VERSION = 1`, `interface PersistedSlice { profiles: Profile[]; activeProfileId: string | null; session: SessionState | null }`, `EMPTY_SLICE`, `migrate(persisted: unknown, version: number): PersistedSlice`.

- [ ] **Step 1: Write failing tests**

`src/state/profile.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, clampSettings, newProfile } from './profile'

describe('newProfile', () => {
  it('starts at level 1 with default settings', () => {
    const p = newProfile('Ada', '🐱', 5000, 'id-1')
    expect(p).toMatchObject({ id: 'id-1', name: 'Ada', avatarEmoji: '🐱', createdAt: 5000 })
    expect(p.settings).toEqual(DEFAULT_SETTINGS)
    expect(p.progression.unlocks).toEqual([
      { chordId: 'red', unlockedAt: 5000 },
      { chordId: 'yellow', unlockedAt: 5000 },
    ])
    expect(p.progression.lastNapChangeAt).toBe(5000)
    expect(DEFAULT_SETTINGS).toMatchObject({
      pacing: 'unlimited', instrumentId: 'piano', sessionTarget: 20, showLetters: false, intensity: 'full',
    })
  })

  it('clamps session target and pacing params', () => {
    const s = clampSettings({
      ...DEFAULT_SETTINGS,
      sessionTarget: 200,
      pacingParams: { ...DEFAULT_SETTINGS.pacingParams, streakTarget: 0 },
    })
    expect(s.sessionTarget).toBe(50)
    expect(s.pacingParams.streakTarget).toBe(3)
    expect(clampSettings({ ...DEFAULT_SETTINGS, sessionTarget: 4 }).sessionTarget).toBe(10)
  })
})
```

`src/state/eventBus.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { emitEngineEvents, onEngineEvent } from './eventBus'

describe('eventBus', () => {
  it('delivers events in order to every listener until unsubscribed', () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = onEngineEvent(a)
    onEngineEvent(b)
    emitEngineEvents([{ type: 'readyForUnlock' }, { type: 'streakMilestone', streak: 5 }])
    expect(a.mock.calls.map((c) => c[0].type)).toEqual(['readyForUnlock', 'streakMilestone'])
    offA()
    emitEngineEvents([{ type: 'readyForUnlock' }])
    expect(a).toHaveBeenCalledTimes(2)
    expect(b).toHaveBeenCalledTimes(3)
  })

  it('a throwing listener does not stop the others', () => {
    const bad = vi.fn(() => { throw new Error('boom') })
    const good = vi.fn()
    const off1 = onEngineEvent(bad)
    const off2 = onEngineEvent(good)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    emitEngineEvents([{ type: 'readyForUnlock' }])
    expect(good).toHaveBeenCalledTimes(1)
    errSpy.mockRestore()
    off1()
    off2()
  })
})
```

`src/state/storage.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { BACKUP_KEY, STORAGE_KEY, createMemoryStorage, createSafeStorage } from './storage'

describe('createSafeStorage', () => {
  it('passes valid JSON through', () => {
    const backing = createMemoryStorage()
    backing.setItem(STORAGE_KEY, '{"state":{},"version":1}')
    const safe = createSafeStorage(backing)
    expect(safe.getItem(STORAGE_KEY)).toBe('{"state":{},"version":1}')
    expect(safe.corrupted).toBe(false)
  })

  it('backs up and drops corrupt JSON', () => {
    const backing = createMemoryStorage()
    backing.setItem(STORAGE_KEY, '{not json')
    const safe = createSafeStorage(backing)
    expect(safe.getItem(STORAGE_KEY)).toBeNull()
    expect(backing.getItem(BACKUP_KEY)).toBe('{not json')
    expect(safe.corrupted).toBe(true)
  })

  it('records write failures instead of throwing', () => {
    const backing = createMemoryStorage()
    backing.setItem = () => { throw new Error('QuotaExceededError') }
    const safe = createSafeStorage(backing)
    expect(() => safe.setItem(STORAGE_KEY, '{}')).not.toThrow()
    expect(safe.writeFailed).toBe(true)
  })

  it('removeItem works', () => {
    const backing = createMemoryStorage()
    backing.setItem(STORAGE_KEY, '{}')
    createSafeStorage(backing).removeItem(STORAGE_KEY)
    expect(backing.getItem(STORAGE_KEY)).toBeNull()
  })
})
```

`src/state/migrations.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { makeProfile } from '../core/testing/fixtures'
import { EMPTY_SLICE, PERSIST_VERSION, migrate } from './migrations'

describe('migrate', () => {
  it('returns a current-version slice unchanged', () => {
    const slice = { profiles: [makeProfile()], activeProfileId: 'p1', session: null }
    expect(migrate(slice, PERSIST_VERSION)).toEqual(slice)
  })

  it('falls back to the empty slice for unrecognised shapes', () => {
    expect(migrate(null, PERSIST_VERSION)).toEqual(EMPTY_SLICE)
    expect(migrate({ profiles: 'nope' }, PERSIST_VERSION)).toEqual(EMPTY_SLICE)
    expect(migrate({ profiles: [] }, 999)).toEqual(EMPTY_SLICE)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/state
```

- [ ] **Step 3: Implement**

`src/state/profile.ts`:
```ts
import { initialUnlocks } from '../core/content/curriculum'
import { DEFAULT_INSTRUMENT_ID } from '../core/content/instruments'
import { DEFAULT_PACING_PARAMS, clampPacingParams } from '../core/engine/pacing'
import type { Profile, ProfileSettings } from '../core/types'

export const SESSION_TARGET_LIMITS: [number, number] = [10, 50]

export const DEFAULT_SETTINGS: ProfileSettings = {
  pacing: 'unlimited',
  pacingParams: DEFAULT_PACING_PARAMS,
  instrumentId: DEFAULT_INSTRUMENT_ID,
  sessionTarget: 20,
  showLetters: false,
  intensity: 'full',
  celebrationSound: true,
  haptics: true,
}

export function clampSettings(settings: ProfileSettings): ProfileSettings {
  const [min, max] = SESSION_TARGET_LIMITS
  return {
    ...settings,
    sessionTarget: Math.min(max, Math.max(min, Math.round(settings.sessionTarget))),
    pacingParams: clampPacingParams(settings.pacingParams),
  }
}

export function newProfile(name: string, avatarEmoji: string, now: number, id: string): Profile {
  return {
    id,
    name,
    avatarEmoji,
    createdAt: now,
    settings: DEFAULT_SETTINGS,
    progression: {
      unlocks: initialUnlocks(now),
      napping: null,
      lastNapChangeAt: now,
      streak: 0,
      bestStreak: 0,
      heat: 0,
      chordStats: {},
      recentAnswers: [],
      sessions: [],
      stars: 0,
      readyForUnlock: false,
    },
  }
}
```

`src/state/eventBus.ts`:
```ts
import type { EngineEvent } from '../core/engine/events'

type Listener = (event: EngineEvent) => void

const listeners = new Set<Listener>()

export function onEngineEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitEngineEvents(events: EngineEvent[]): void {
  for (const event of events) {
    for (const listener of [...listeners]) {
      try {
        listener(event)
      } catch (err) {
        console.error('engine event listener failed', err)
      }
    }
  }
}
```

`src/state/storage.ts`:
```ts
import type { StateStorage } from 'zustand/middleware'

export const STORAGE_KEY = 'ear-trainer'
export const BACKUP_KEY = 'ear-trainer.backup'

export interface SafeStorage extends StateStorage {
  corrupted: boolean
  writeFailed: boolean
}

/** Wraps a Storage so corrupt JSON is backed up (not lost) and write failures do not throw. */
export function createSafeStorage(backing: Storage): SafeStorage {
  const safe: SafeStorage = {
    corrupted: false,
    writeFailed: false,
    getItem(name) {
      const raw = backing.getItem(name)
      if (raw === null) return null
      try {
        JSON.parse(raw)
        return raw
      } catch {
        backing.setItem(BACKUP_KEY, raw)
        backing.removeItem(name)
        safe.corrupted = true
        return null
      }
    },
    setItem(name, value) {
      try {
        backing.setItem(name, value)
      } catch {
        safe.writeFailed = true
      }
    },
    removeItem(name) {
      backing.removeItem(name)
    },
  }
  return safe
}

export function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  }
}
```

`src/state/migrations.ts`:
```ts
import type { SessionState } from '../core/engine/session'
import type { Profile } from '../core/types'

export const PERSIST_VERSION = 1

export interface PersistedSlice {
  profiles: Profile[]
  activeProfileId: string | null
  session: SessionState | null
}

export const EMPTY_SLICE: PersistedSlice = { profiles: [], activeProfileId: null, session: null }

type Migration = (state: Record<string, unknown>) => Record<string, unknown>

/** Index i migrates from version i to i+1. Empty until the shape changes. */
const MIGRATIONS: Migration[] = []

function isSlice(x: unknown): x is PersistedSlice {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return Array.isArray(o.profiles) && ('activeProfileId' in o) && ('session' in o)
}

export function migrate(persisted: unknown, version: number): PersistedSlice {
  if (typeof persisted !== 'object' || persisted === null || version > PERSIST_VERSION) return EMPTY_SLICE
  let state = persisted as Record<string, unknown>
  for (let v = version; v < PERSIST_VERSION; v++) {
    const step = MIGRATIONS[v]
    if (!step) return EMPTY_SLICE
    state = step(state)
  }
  return isSlice(state) ? state : EMPTY_SLICE
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/state
```
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add profile factory, event bus, safe storage and migrations"
```

---

### Task 11: Zustand store and profile export/import

**Files:**
- Create: `src/state/store.ts`, `src/state/exportImport.ts`
- Test: `src/state/store.test.ts`, `src/state/exportImport.test.ts`

**Interfaces:**
- Consumes: engine functions (Task 9), `PersistedSlice`/`migrate` (Task 10), `SafeStorage`, `emitEngineEvents`, `newProfile`, `clampSettings`, curriculum helpers.
- Produces:
  ```ts
  type Screen = 'profiles' | 'home' | 'getReady' | 'session' | 'summary' | 'parent'
  interface AppState extends PersistedSlice {
    screen: Screen
    pendingPrimer: string[] | null
    storageNotice: 'corrupt' | 'writeFailed' | null
    goTo(screen: Screen): void
    createProfile(name: string, avatarEmoji: string): string
    deleteProfile(id: string): void
    selectProfile(id: string | null): void
    updateSettings(patch: Partial<ProfileSettings>): void
    startSession(): void
    answer(chordId: string): void
    advance(): void
    continueAfterLevelUp(): void
    endSession(): void
    clearPrimer(): void
    parentUnlockNext(): void
    parentWake(): void
    parentRewind(): void
    parentResetProgress(): void
    importProfile(json: string): void
    dismissNotice(): void
  }
  interface StoreDeps { now: () => number; rng: Rng; storage: SafeStorage; uuid: () => string }
  createAppStore(deps: StoreDeps): UseBoundStore<StoreApi<AppState>>
  useAppStore  // default instance bound to window.localStorage
  activeProfile(state: AppState): Profile | null
  // exportImport.ts
  exportProfile(profile: Profile): string
  parseProfileExport(json: string): Profile   // throws Error('invalid profile file') on bad input
  ```
- Screen transitions owned by actions: `createProfile`/`selectProfile` → `home`; `startSession` → `session`; session reaching `summary` phase → `summary`; `deleteProfile` of the active profile → `profiles`.
- `continueAfterLevelUp` sets `pendingPrimer` to all awake chord ids (curriculum order, newest last). A `chordWoken` event during `answer` sets `pendingPrimer` to `[wokenId]`.

- [ ] **Step 1: Write failing tests**

`src/state/exportImport.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { makeProfile } from '../core/testing/fixtures'
import { exportProfile, parseProfileExport } from './exportImport'

describe('export/import', () => {
  it('round-trips a profile', () => {
    const p = makeProfile()
    const json = exportProfile(p)
    expect(JSON.parse(json)).toMatchObject({ format: 'ear-trainer-profile', version: 1 })
    expect(parseProfileExport(json)).toEqual(p)
  })

  it('rejects garbage', () => {
    expect(() => parseProfileExport('nope')).toThrow(/invalid profile file/)
    expect(() => parseProfileExport('{"format":"other"}')).toThrow(/invalid profile file/)
    expect(() => parseProfileExport('{"format":"ear-trainer-profile","version":1,"profile":{}}')).toThrow(/invalid profile file/)
  })
})
```

`src/state/store.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mulberry32 } from '../core/engine/rng'
import { makeProfile } from '../core/testing/fixtures'
import { onEngineEvent } from './eventBus'
import { exportProfile } from './exportImport'
import { PERSIST_VERSION } from './migrations'
import { STORAGE_KEY, createMemoryStorage, createSafeStorage } from './storage'
import { activeProfile, createAppStore } from './store'

let clock = 1000
const rng = mulberry32(5)
let ids = 0

function makeStore(backing = createMemoryStorage()) {
  const storage = createSafeStorage(backing)
  const store = createAppStore({ now: () => clock, rng, storage, uuid: () => `id-${++ids}` })
  return { store, backing, storage }
}

beforeEach(() => {
  clock = 1000
  ids = 0
})

describe('profiles', () => {
  it('creates, selects and deletes profiles with screen transitions', () => {
    const { store } = makeStore()
    expect(store.getState().screen).toBe('profiles')
    const id = store.getState().createProfile('Ada', '🐱')
    expect(id).toBe('id-1')
    expect(store.getState().activeProfileId).toBe('id-1')
    expect(store.getState().screen).toBe('home')
    expect(activeProfile(store.getState())?.name).toBe('Ada')

    store.getState().selectProfile(null)
    expect(store.getState().screen).toBe('profiles')
    store.getState().selectProfile('id-1')
    expect(store.getState().screen).toBe('home')

    store.getState().deleteProfile('id-1')
    expect(store.getState().profiles).toEqual([])
    expect(store.getState().activeProfileId).toBeNull()
    expect(store.getState().screen).toBe('profiles')
  })

  it('updates and clamps settings', () => {
    const { store } = makeStore()
    store.getState().createProfile('Ada', '🐱')
    store.getState().updateSettings({ sessionTarget: 999, instrumentId: 'organ' })
    expect(activeProfile(store.getState())?.settings).toMatchObject({ sessionTarget: 50, instrumentId: 'organ' })
  })
})

describe('session actions', () => {
  it('runs a session through the engine, emits events and navigates', () => {
    const { store } = makeStore()
    const seen: string[] = []
    const off = onEngineEvent((e) => seen.push(e.type))
    store.getState().createProfile('Ada', '🐱')
    store.getState().updateSettings({ sessionTarget: 10, pacing: 'manual' })

    store.getState().startSession()
    expect(store.getState().screen).toBe('session')
    expect(store.getState().session?.phase).toBe('question')
    expect(seen).toEqual(['sessionStarted', 'questionAsked'])

    for (let i = 0; i < 10; i++) {
      clock += 1
      const s = store.getState().session!
      store.getState().answer(s.currentChordId!)
      expect(store.getState().session?.phase).toBe('feedback')
      store.getState().advance()
    }
    expect(store.getState().session?.phase).toBe('summary')
    expect(store.getState().screen).toBe('summary')
    expect(activeProfile(store.getState())?.progression.sessions).toHaveLength(1)
    expect(seen.filter((t) => t === 'sessionComplete')).toHaveLength(1)
    off()
  })

  it('queues the primer after a level-up and clears it', () => {
    const { store } = makeStore()
    store.getState().createProfile('Ada', '🐱')
    store.getState().updateSettings({ pacingParams: { streakTarget: 3, eguchiWindow: 40, eguchiDays: 14, eguchiSessions: 10 } })
    store.getState().startSession()
    let guard = 0
    while (store.getState().session?.phase !== 'levelUp' && guard++ < 20) {
      const s = store.getState().session!
      store.getState().answer(s.currentChordId!)
      store.getState().advance()
    }
    expect(store.getState().session?.phase).toBe('levelUp')
    store.getState().continueAfterLevelUp()
    expect(store.getState().pendingPrimer).toEqual(['red', 'yellow', 'blue'])
    expect(store.getState().session?.phase).toBe('question')
    store.getState().clearPrimer()
    expect(store.getState().pendingPrimer).toBeNull()
  })

  it('endSession from mid-session records and navigates to summary', () => {
    const { store } = makeStore()
    store.getState().createProfile('Ada', '🐱')
    store.getState().startSession()
    const s = store.getState().session!
    store.getState().answer(s.currentChordId!)
    store.getState().advance()
    store.getState().endSession()
    expect(store.getState().screen).toBe('summary')
    expect(activeProfile(store.getState())?.progression.sessions[0]).toMatchObject({ count: 1, countsForPacing: false })
  })
})

describe('parent actions', () => {
  it('unlocks, rewinds, wakes and resets', () => {
    const { store } = makeStore()
    store.getState().createProfile('Ada', '🐱')
    store.getState().parentUnlockNext()
    expect(activeProfile(store.getState())?.progression.unlocks.map((u) => u.chordId)).toEqual(['red', 'yellow', 'blue'])
    store.getState().parentRewind()
    expect(activeProfile(store.getState())?.progression.unlocks.map((u) => u.chordId)).toEqual(['red', 'yellow'])
    store.getState().parentRewind()
    expect(activeProfile(store.getState())?.progression.unlocks).toHaveLength(2)

    store.getState().parentUnlockNext()
    store.setState((st) => ({
      profiles: st.profiles.map((p) => ({ ...p, progression: { ...p.progression, napping: 'blue' } })),
    }))
    store.getState().parentWake()
    expect(activeProfile(store.getState())?.progression.napping).toBeNull()

    store.getState().parentResetProgress()
    expect(activeProfile(store.getState())?.progression.unlocks).toHaveLength(2)
    expect(activeProfile(store.getState())?.progression.sessions).toEqual([])
  })
})

describe('persistence', () => {
  it('persists profiles and rehydrates in a fresh store', () => {
    const { store, backing } = makeStore()
    store.getState().createProfile('Ada', '🐱')
    const raw = JSON.parse(backing.getItem(STORAGE_KEY)!)
    expect(raw.version).toBe(PERSIST_VERSION)
    expect(raw.state.profiles[0].name).toBe('Ada')
    expect(raw.state.screen).toBeUndefined()

    const again = makeStore(backing)
    expect(again.store.getState().profiles[0].name).toBe('Ada')
    expect(again.store.getState().activeProfileId).toBe('id-1')
    expect(again.store.getState().screen).toBe('profiles')
  })

  it('surfaces corrupt storage as a notice and keeps a backup', () => {
    const backing = createMemoryStorage()
    backing.setItem(STORAGE_KEY, '{broken')
    const { store } = makeStore(backing)
    expect(store.getState().profiles).toEqual([])
    expect(store.getState().storageNotice).toBe('corrupt')
    expect(backing.getItem('ear-trainer.backup')).toBe('{broken')
    store.getState().dismissNotice()
    expect(store.getState().storageNotice).toBeNull()
  })

  it('imports a profile, assigning a fresh id on collision', () => {
    const { store } = makeStore()
    store.getState().createProfile('Ada', '🐱')
    const exported = exportProfile({ ...makeProfile(), id: 'id-1', name: 'Imported' })
    store.getState().importProfile(exported)
    expect(store.getState().profiles.map((p) => [p.id, p.name])).toEqual([['id-1', 'Ada'], ['id-2', 'Imported']])
    expect(() => store.getState().importProfile('junk')).toThrow(/invalid profile file/)
  })
})

describe('write failures', () => {
  it('sets a notice when storage writes fail', () => {
    const backing = createMemoryStorage()
    backing.setItem = () => { throw new Error('quota') }
    const { store } = makeStore(backing)
    store.getState().createProfile('Ada', '🐱')
    expect(store.getState().storageNotice).toBe('writeFailed')
    vi.restoreAllMocks()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/state/store.test.ts src/state/exportImport.test.ts
```

- [ ] **Step 3: Implement `src/state/exportImport.ts`**

```ts
import type { Profile } from '../core/types'

const FORMAT = 'ear-trainer-profile'
const VERSION = 1

export function exportProfile(profile: Profile): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, profile }, null, 2)
}

function looksLikeProfile(x: unknown): x is Profile {
  if (typeof x !== 'object' || x === null) return false
  const p = x as Record<string, unknown>
  const prog = p.progression as Record<string, unknown> | undefined
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.settings === 'object' &&
    prog !== undefined &&
    Array.isArray(prog.unlocks) &&
    Array.isArray(prog.sessions)
  )
}

export function parseProfileExport(json: string): Profile {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('invalid profile file')
  }
  const o = parsed as Record<string, unknown> | null
  if (!o || o.format !== FORMAT || o.version !== VERSION || !looksLikeProfile(o.profile)) {
    throw new Error('invalid profile file')
  }
  return o.profile
}
```

- [ ] **Step 4: Implement `src/state/store.ts`**

```ts
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { awakeChordIds, nextChordId } from '../core/content/curriculum'
import type { EngineEvent } from '../core/engine/events'
import type { Rng } from '../core/engine/rng'
import * as engine from '../core/engine/session'
import type { Profile, ProfileSettings } from '../core/types'
import { emitEngineEvents } from './eventBus'
import { parseProfileExport } from './exportImport'
import { EMPTY_SLICE, PERSIST_VERSION, migrate, type PersistedSlice } from './migrations'
import { clampSettings, newProfile } from './profile'
import { STORAGE_KEY, createSafeStorage, type SafeStorage } from './storage'

export type Screen = 'profiles' | 'home' | 'getReady' | 'session' | 'summary' | 'parent'

export interface AppState extends PersistedSlice {
  screen: Screen
  pendingPrimer: string[] | null
  storageNotice: 'corrupt' | 'writeFailed' | null
  goTo(screen: Screen): void
  createProfile(name: string, avatarEmoji: string): string
  deleteProfile(id: string): void
  selectProfile(id: string | null): void
  updateSettings(patch: Partial<ProfileSettings>): void
  startSession(): void
  answer(chordId: string): void
  advance(): void
  continueAfterLevelUp(): void
  endSession(): void
  clearPrimer(): void
  parentUnlockNext(): void
  parentWake(): void
  parentRewind(): void
  parentResetProgress(): void
  importProfile(json: string): void
  dismissNotice(): void
}

export interface StoreDeps {
  now: () => number
  rng: Rng
  storage: SafeStorage
  uuid: () => string
}

export function activeProfile(state: Pick<AppState, 'profiles' | 'activeProfileId'>): Profile | null {
  return state.profiles.find((p) => p.id === state.activeProfileId) ?? null
}

export function createAppStore(deps: StoreDeps) {
  const store = create<AppState>()(
    persist(
      (set, get) => {
        const withActive = (fn: (p: Profile) => Profile) =>
          set((s) => ({
            profiles: s.profiles.map((p) => (p.id === s.activeProfileId ? fn(p) : p)),
          }))

        /** Applies an engine result to the active profile and session, then emits its events. */
        const apply = (
          run: (profile: Profile, session: engine.SessionState | null) => engine.EngineResult | null,
        ) => {
          const s = get()
          const profile = activeProfile(s)
          if (!profile) return
          const result = run(profile, s.session)
          if (!result) return
          const patch: Partial<AppState> = {
            session: result.session,
            profiles: s.profiles.map((p) =>
              p.id === profile.id ? { ...p, progression: result.progression } : p,
            ),
          }
          if (result.session.phase === 'summary') patch.screen = 'summary'
          const woken = result.events.find((e): e is Extract<EngineEvent, { type: 'chordWoken' }> => e.type === 'chordWoken')
          if (woken) patch.pendingPrimer = [woken.chordId]
          set(patch)
          emitEngineEvents(result.events)
          if (deps.storage.writeFailed && get().storageNotice === null) set({ storageNotice: 'writeFailed' })
        }

        const engineDeps = () => ({ now: deps.now(), rng: deps.rng })

        return {
          ...EMPTY_SLICE,
          screen: 'profiles',
          pendingPrimer: null,
          storageNotice: null,

          goTo: (screen) => set({ screen }),

          createProfile: (name, avatarEmoji) => {
            const profile = newProfile(name, avatarEmoji, deps.now(), deps.uuid())
            set((s) => ({ profiles: [...s.profiles, profile], activeProfileId: profile.id, screen: 'home' }))
            if (deps.storage.writeFailed) set({ storageNotice: 'writeFailed' })
            return profile.id
          },

          deleteProfile: (id) =>
            set((s) => {
              const active = s.activeProfileId === id
              return {
                profiles: s.profiles.filter((p) => p.id !== id),
                activeProfileId: active ? null : s.activeProfileId,
                session: active ? null : s.session,
                screen: active ? 'profiles' : s.screen,
              }
            }),

          selectProfile: (id) => set({ activeProfileId: id, session: null, screen: id ? 'home' : 'profiles' }),

          updateSettings: (patch) =>
            withActive((p) => ({ ...p, settings: clampSettings({ ...p.settings, ...patch }) })),

          startSession: () => {
            apply((profile) => engine.startSession(profile, engineDeps()))
            set({ screen: 'session', pendingPrimer: null })
          },

          answer: (chordId) =>
            apply((profile, session) => (session ? engine.answer(profile, session, chordId, engineDeps()) : null)),

          advance: () =>
            apply((profile, session) => (session ? engine.advance(profile, session, engineDeps()) : null)),

          continueAfterLevelUp: () => {
            apply((profile, session) =>
              session ? engine.continueAfterLevelUp(profile, session, engineDeps()) : null,
            )
            const profile = activeProfile(get())
            if (profile && get().session?.phase === 'question') {
              set({ pendingPrimer: awakeChordIds(profile.progression) })
            }
          },

          endSession: () =>
            apply((profile, session) => (session ? engine.endSession(profile, session, engineDeps()) : null)),

          clearPrimer: () => set({ pendingPrimer: null }),

          parentUnlockNext: () =>
            withActive((p) => {
              const chordId = nextChordId(p.progression.unlocks)
              if (!chordId) return p
              const now = deps.now()
              return {
                ...p,
                progression: {
                  ...p.progression,
                  unlocks: [...p.progression.unlocks, { chordId, unlockedAt: now }],
                  readyForUnlock: false,
                  lastNapChangeAt: now,
                },
              }
            }),

          parentWake: () =>
            withActive((p) => ({
              ...p,
              progression: { ...p.progression, napping: null, lastNapChangeAt: deps.now() },
            })),

          parentRewind: () =>
            withActive((p) => {
              if (p.progression.unlocks.length <= 2) return p
              const unlocks = p.progression.unlocks.slice(0, -1)
              const removed = p.progression.unlocks[p.progression.unlocks.length - 1].chordId
              return {
                ...p,
                progression: {
                  ...p.progression,
                  unlocks,
                  napping: p.progression.napping === removed ? null : p.progression.napping,
                  readyForUnlock: false,
                  lastNapChangeAt: deps.now(),
                },
              }
            }),

          parentResetProgress: () =>
            withActive((p) => ({
              ...p,
              progression: newProfile(p.name, p.avatarEmoji, deps.now(), p.id).progression,
            })),

          importProfile: (json) => {
            const imported = parseProfileExport(json)
            set((s) => {
              const taken = new Set(s.profiles.map((p) => p.id))
              const id = taken.has(imported.id) ? deps.uuid() : imported.id
              return { profiles: [...s.profiles, { ...imported, id, settings: clampSettings(imported.settings) }] }
            })
          },

          dismissNotice: () => set({ storageNotice: null }),
        }
      },
      {
        name: STORAGE_KEY,
        version: PERSIST_VERSION,
        storage: createJSONStorage(() => deps.storage),
        partialize: (s): PersistedSlice => ({
          profiles: s.profiles,
          activeProfileId: s.activeProfileId,
          session: s.session,
        }),
        migrate: (persisted, version) => migrate(persisted, version) as unknown as AppState,
      },
    ),
  )
  if (deps.storage.corrupted) store.setState({ storageNotice: 'corrupt' })
  return store
}

export const useAppStore = createAppStore({
  now: () => Date.now(),
  rng: Math.random,
  storage: createSafeStorage(window.localStorage),
  uuid: () => crypto.randomUUID(),
})
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/state
```
Expected: PASS. If `store.test.ts` fails on the `screen` assertion after rehydration, confirm `partialize` excludes `screen` (the test asserts `raw.state.screen` is undefined).

If the `write failures` test does not see the notice: `createProfile` checks `deps.storage.writeFailed` right after `set`, and zustand persist writes synchronously for sync storages, so the flag is set by then.

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck && npx vitest run
git add -A
git commit -m "Add persisted Zustand store and profile export/import"
```

---

### Task 12: Audio layer

**Files:**
- Create: `src/audio/notes.ts`, `src/audio/duration.ts`, `src/audio/player.ts`, `src/audio/loading.ts`, `src/audio/tonePlayer.ts`, `src/audio/sfx.ts`
- Test: `src/audio/notes.test.ts`, `src/audio/duration.test.ts`, `src/audio/loading.test.ts`, `src/audio/tonePlayer.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // notes.ts
  noteToMidi(note: string): number                    // 'C#4' -> 61, 'Bb3' -> 58; throws on malformed
  nearestSamples(instrument: Instrument, notes: string[]): Record<string, string>  // subset of instrument.samples
  // duration.ts
  randomDuration(rng: Rng): number                    // seconds, clipped to [1.5, 2.5]
  // player.ts
  interface AudioPlayer {
    unlock(): Promise<void>
    loadInstrument(instrument: Instrument, notes: string[]): Promise<void>
    playChord(notes: string[], durationSec: number): void
    stopAll(): void
  }
  interface NullPlayer extends AudioPlayer { played: { notes: string[]; durationSec: number }[]; loaded: string[]; unlocked: boolean; failLoads: number }
  createNullPlayer(): NullPlayer
  // loading.ts
  loadWithFallback(player, instrument, notes, fallback: Instrument, sleep?): Promise<{ instrument: Instrument; fellBack: boolean }>
  // tonePlayer.ts
  createTonePlayer(): AudioPlayer
  // sfx.ts
  interface Sfx { whoosh(): void; pop(): void; thud(): void; cymbal(): void; steam(): void; fanfare(): void }
  createToneSfx(): Sfx
  createNullSfx(): Sfx & { calls: string[] }
  ```
- `loadWithFallback` tries the requested instrument three times (0, 500, 1000 ms backoff), then the fallback three times, then throws `Error('audio unavailable')`.

- [ ] **Step 1: Write failing tests**

`src/audio/notes.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { instrumentById } from '../core/content/instruments'
import { nearestSamples, noteToMidi } from './notes'

describe('noteToMidi', () => {
  it('converts scientific pitch names', () => {
    expect(noteToMidi('C4')).toBe(60)
    expect(noteToMidi('C#4')).toBe(61)
    expect(noteToMidi('Bb3')).toBe(58)
    expect(noteToMidi('A0')).toBe(21)
    expect(() => noteToMidi('H4')).toThrow()
  })
})

describe('nearestSamples', () => {
  it('returns the nearest sample for each requested note, deduplicated', () => {
    const violin = instrumentById('violin')
    const subset = nearestSamples(violin, ['C4', 'E4', 'G4', 'B3'])
    expect(Object.keys(subset).sort()).toEqual(['C4', 'E4', 'G4'])
    expect(subset.C4).toBe('C4.mp3')
  })

  it('picks the closer neighbour for in-between notes', () => {
    const piano = instrumentById('piano')
    expect(Object.keys(nearestSamples(piano, ['D4']))).toEqual(['D#4'])
    expect(Object.keys(nearestSamples(piano, ['B3']))).toEqual(['C4'])
  })
})
```

`src/audio/duration.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../core/engine/rng'
import { randomDuration } from './duration'

describe('randomDuration', () => {
  it('stays within 1.5–2.5 s and varies', () => {
    const rng = mulberry32(9)
    const xs = Array.from({ length: 200 }, () => randomDuration(rng))
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(1.5)
      expect(x).toBeLessThanOrEqual(2.5)
    }
    expect(new Set(xs.map((x) => x.toFixed(2))).size).toBeGreaterThan(20)
  })
})
```

`src/audio/loading.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { instrumentById } from '../core/content/instruments'
import { loadWithFallback } from './loading'
import { createNullPlayer } from './player'

const noSleep = async () => {}

describe('loadWithFallback', () => {
  it('loads the requested instrument on first try', async () => {
    const player = createNullPlayer()
    const r = await loadWithFallback(player, instrumentById('organ'), ['C4'], instrumentById('piano'), noSleep)
    expect(r).toEqual({ instrument: instrumentById('organ'), fellBack: false })
    expect(player.loaded).toEqual(['organ'])
  })

  it('retries twice then falls back to piano', async () => {
    const player = createNullPlayer()
    player.failLoads = 3
    const r = await loadWithFallback(player, instrumentById('organ'), ['C4'], instrumentById('piano'), noSleep)
    expect(r.fellBack).toBe(true)
    expect(r.instrument.id).toBe('piano')
    expect(player.loaded).toEqual(['organ', 'organ', 'organ', 'piano'])
  })

  it('throws when the fallback also fails three times', async () => {
    const player = createNullPlayer()
    player.failLoads = 6
    await expect(
      loadWithFallback(player, instrumentById('organ'), ['C4'], instrumentById('piano'), noSleep),
    ).rejects.toThrow(/audio unavailable/)
  })

  it('does not retry the fallback separately when it is the requested instrument', async () => {
    const player = createNullPlayer()
    player.failLoads = 3
    await expect(
      loadWithFallback(player, instrumentById('piano'), ['C4'], instrumentById('piano'), noSleep),
    ).rejects.toThrow(/audio unavailable/)
    expect(player.loaded).toHaveLength(3)
  })
})
```

`src/audio/tonePlayer.test.ts` (mocks the `tone` module):
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const samplers: FakeSampler[] = []
class FakeSampler {
  urls: Record<string, string>
  opts: Record<string, unknown>
  added: Record<string, string> = {}
  triggered: { notes: string[]; duration: number }[] = []
  released = 0
  constructor(opts: Record<string, unknown>) {
    this.opts = opts
    this.urls = opts.urls as Record<string, string>
    samplers.push(this)
    queueMicrotask(() => (opts.onload as () => void)())
  }
  toDestination() { return this }
  add(note: string, url: string, cb?: () => void) { this.added[note] = url; cb?.(); return this }
  triggerAttackRelease(notes: string[], duration: number) { this.triggered.push({ notes, duration }); return this }
  releaseAll() { this.released++; return this }
}
const start = vi.fn(async () => {})
const resume = vi.fn(async () => {})
vi.mock('tone', () => ({
  Sampler: FakeSampler,
  start,
  getContext: () => ({ state: 'suspended', resume }),
}))

import { instrumentById } from '../core/content/instruments'
import { createTonePlayer } from './tonePlayer'

beforeEach(() => {
  samplers.length = 0
  start.mockClear()
  resume.mockClear()
})

describe('createTonePlayer', () => {
  it('unlock starts Tone and resumes a suspended context', async () => {
    await createTonePlayer().unlock()
    expect(start).toHaveBeenCalledTimes(1)
    expect(resume).toHaveBeenCalledTimes(1)
  })

  it('creates one sampler per instrument with only the nearest samples, then adds more', async () => {
    const player = createTonePlayer()
    const piano = instrumentById('piano')
    await player.loadInstrument(piano, ['C4', 'E4', 'G4'])
    expect(samplers).toHaveLength(1)
    expect(Object.keys(samplers[0].urls).sort()).toEqual(['C4', 'D#4', 'F#4'])
    expect(samplers[0].opts.baseUrl).toBe('/samples/piano/')
    expect(samplers[0].opts.release).toBe(1.2)

    await player.loadInstrument(piano, ['A3'])
    expect(samplers).toHaveLength(1)
    expect(samplers[0].added).toEqual({ A3: 'A3.mp3' })
  })

  it('plays chords on the most recently loaded instrument', async () => {
    const player = createTonePlayer()
    await player.loadInstrument(instrumentById('piano'), ['C4'])
    await player.loadInstrument(instrumentById('organ'), ['C4'])
    player.playChord(['C4', 'E4', 'G4'], 2)
    expect(samplers[1].triggered).toEqual([{ notes: ['C4', 'E4', 'G4'], duration: 2 }])
    expect(samplers[0].triggered).toEqual([])
    player.stopAll()
    expect(samplers[1].released).toBe(1)
  })

  it('playChord before any load is a no-op', () => {
    expect(() => createTonePlayer().playChord(['C4'], 1)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/audio
```

- [ ] **Step 3: Implement**

`src/audio/notes.ts`:
```ts
import type { Instrument } from '../core/types'

const BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export function noteToMidi(note: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(note)
  if (!m) throw new Error(`bad note: ${note}`)
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return (Number(m[3]) + 1) * 12 + BASE[m[1]] + acc
}

export function nearestSamples(instrument: Instrument, notes: string[]): Record<string, string> {
  const available = Object.keys(instrument.samples).map((n) => ({ n, midi: noteToMidi(n) }))
  const out: Record<string, string> = {}
  for (const note of notes) {
    const target = noteToMidi(note)
    let best = available[0]
    for (const cand of available) {
      if (Math.abs(cand.midi - target) < Math.abs(best.midi - target)) best = cand
    }
    out[best.n] = instrument.samples[best.n]
  }
  return out
}
```

`src/audio/duration.ts`:
```ts
import type { Rng } from '../core/engine/rng'

const MEAN = 2
const SD = 0.3
const MIN = 1.5
const MAX = 2.5

export function randomDuration(rng: Rng): number {
  const u = Math.max(rng(), 1e-9)
  const v = rng()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return Math.min(MAX, Math.max(MIN, MEAN + SD * z))
}
```

`src/audio/player.ts`:
```ts
import type { Instrument } from '../core/types'

export interface AudioPlayer {
  unlock(): Promise<void>
  loadInstrument(instrument: Instrument, notes: string[]): Promise<void>
  playChord(notes: string[], durationSec: number): void
  stopAll(): void
}

export interface NullPlayer extends AudioPlayer {
  played: { notes: string[]; durationSec: number }[]
  loaded: string[]
  unlocked: boolean
  /** Number of upcoming loadInstrument calls that should reject. */
  failLoads: number
}

export function createNullPlayer(): NullPlayer {
  const p: NullPlayer = {
    played: [],
    loaded: [],
    unlocked: false,
    failLoads: 0,
    async unlock() {
      p.unlocked = true
    },
    async loadInstrument(instrument) {
      p.loaded.push(instrument.id)
      if (p.failLoads > 0) {
        p.failLoads--
        throw new Error('load failed')
      }
    },
    playChord(notes, durationSec) {
      p.played.push({ notes, durationSec })
    },
    stopAll() {},
  }
  return p
}
```

`src/audio/loading.ts`:
```ts
import type { Instrument } from '../core/types'
import type { AudioPlayer } from './player'

const BACKOFF_MS = [0, 500, 1000]

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function attempt(
  player: AudioPlayer,
  instrument: Instrument,
  notes: string[],
  sleep: (ms: number) => Promise<void>,
): Promise<boolean> {
  for (const ms of BACKOFF_MS) {
    if (ms) await sleep(ms)
    try {
      await player.loadInstrument(instrument, notes)
      return true
    } catch {
      // try again
    }
  }
  return false
}

export async function loadWithFallback(
  player: AudioPlayer,
  instrument: Instrument,
  notes: string[],
  fallback: Instrument,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<{ instrument: Instrument; fellBack: boolean }> {
  if (await attempt(player, instrument, notes, sleep)) return { instrument, fellBack: false }
  if (fallback.id !== instrument.id && (await attempt(player, fallback, notes, sleep))) {
    return { instrument: fallback, fellBack: true }
  }
  throw new Error('audio unavailable')
}
```

`src/audio/tonePlayer.ts`:
```ts
import * as Tone from 'tone'
import type { Instrument } from '../core/types'
import { nearestSamples } from './notes'
import type { AudioPlayer } from './player'

const LOAD_TIMEOUT_MS = 20000

interface Loaded {
  sampler: Tone.Sampler
  notes: Set<string>
}

export function createTonePlayer(): AudioPlayer {
  const instruments = new Map<string, Loaded>()
  let current: Loaded | null = null

  function withTimeout<T>(p: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('sample load timed out')), LOAD_TIMEOUT_MS)
      p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
    })
  }

  return {
    async unlock() {
      await Tone.start()
      const ctx = Tone.getContext()
      if (ctx.state === 'suspended') await ctx.resume()
    },

    async loadInstrument(instrument: Instrument, notes: string[]) {
      const wanted = nearestSamples(instrument, notes)
      let entry = instruments.get(instrument.id)
      if (!entry) {
        const created = await withTimeout(
          new Promise<Tone.Sampler>((resolve, reject) => {
            const sampler = new Tone.Sampler({
              urls: wanted,
              baseUrl: instrument.baseUrl,
              release: instrument.release,
              onload: () => resolve(sampler),
              onerror: reject,
            }).toDestination()
          }),
        )
        entry = { sampler: created, notes: new Set(Object.keys(wanted)) }
        instruments.set(instrument.id, entry)
      } else {
        const missing = Object.entries(wanted).filter(([n]) => !entry!.notes.has(n))
        await withTimeout(
          Promise.all(
            missing.map(
              ([n, file]) =>
                new Promise<void>((resolve) => {
                  entry!.sampler.add(n as Parameters<Tone.Sampler['add']>[0], instrument.baseUrl + file, resolve)
                  entry!.notes.add(n)
                }),
            ),
          ),
        )
      }
      current = entry
    },

    playChord(notes, durationSec) {
      current?.sampler.triggerAttackRelease(notes, durationSec)
    },

    stopAll() {
      current?.sampler.releaseAll()
    },
  }
}
```

`src/audio/sfx.ts` (unpitched by design; see spec §7.4):
```ts
import * as Tone from 'tone'

export interface Sfx {
  whoosh(): void
  pop(): void
  thud(): void
  cymbal(): void
  steam(): void
  fanfare(): void
}

export function createNullSfx(): Sfx & { calls: string[] } {
  const calls: string[] = []
  const rec = (name: string) => () => void calls.push(name)
  return {
    calls,
    whoosh: rec('whoosh'), pop: rec('pop'), thud: rec('thud'),
    cymbal: rec('cymbal'), steam: rec('steam'), fanfare: rec('fanfare'),
  }
}

export function createToneSfx(): Sfx {
  let noise: Tone.NoiseSynth | null = null
  let metal: Tone.MetalSynth | null = null
  let drum: Tone.MembraneSynth | null = null
  let filter: Tone.Filter | null = null

  function ensure() {
    if (noise) return
    filter = new Tone.Filter(1200, 'bandpass').toDestination()
    noise = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.02, decay: 0.3, sustain: 0 } }).connect(filter)
    metal = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.6, release: 0.2 }, harmonicity: 5.1, resonance: 4000, octaves: 1.5 }).toDestination()
    metal.volume.value = -14
    drum = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } }).toDestination()
    drum.volume.value = -6
  }

  return {
    whoosh() {
      ensure()
      filter!.frequency.rampTo(3000, 0.25)
      noise!.envelope.decay = 0.35
      noise!.triggerAttackRelease(0.3)
    },
    pop() {
      ensure()
      filter!.frequency.value = 2500
      noise!.envelope.decay = 0.08
      noise!.triggerAttackRelease(0.05)
    },
    thud() {
      ensure()
      drum!.triggerAttackRelease('C1', 0.2)
    },
    cymbal() {
      ensure()
      metal!.triggerAttackRelease('C3', 0.5)
    },
    steam() {
      ensure()
      filter!.frequency.value = 800
      noise!.envelope.decay = 0.9
      noise!.triggerAttackRelease(0.8)
    },
    fanfare() {
      ensure()
      const t = Tone.now()
      drum!.triggerAttackRelease('C1', 0.2, t)
      drum!.triggerAttackRelease('C1', 0.2, t + 0.18)
      drum!.triggerAttackRelease('C1', 0.3, t + 0.36)
      metal!.triggerAttackRelease('C3', 0.8, t + 0.36)
    },
  }
}
```

`MembraneSynth` and `MetalSynth` take a note argument for their resonant body but are percussive and untuned to the chord vocabulary; that is the intended "unpitched" fanfare.

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/audio
```
Expected: PASS (12 tests). If `tonePlayer.test.ts` fails to import because the mock lacks a Tone export used by `sfx.ts`, note that `sfx.ts` is not imported by the test; only `tonePlayer.ts` is.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "Add audio player, sample loading with fallback, and unpitched SFX"
```

---

### Task 13: Particle engine, emitters, presets, heat colors

**Files:**
- Create: `src/celebrations/particles.ts`, `src/celebrations/emitters.ts`, `src/celebrations/presets.ts`, `src/celebrations/heat.ts`
- Test: `src/celebrations/particles.test.ts`, `src/celebrations/emitters.test.ts`, `src/celebrations/presets.test.ts`, `src/celebrations/heat.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // particles.ts
  type Shape = 'circle' | 'rect' | 'spark'
  interface Particle { x; y; vx; vy; life; maxLife; size; color; shape; gravity; drag; rotation; spin; trail: boolean; onDeath: ((p: Particle) => void) | null }
  interface EmitSpec { x; y; count; speed: [min, max]; angle: [min, max] /* radians, 0 = right, -PI/2 = up */; life: [min, max]; size: [min, max]; colors: string[]; gravity?; drag?; shape?; trail?; onDeath? }
  class ParticleSystem {
    constructor(max = 1500, rng: Rng = Math.random)
    readonly particles: Particle[]
    get count(): number
    setMax(n: number): void
    emit(spec: EmitSpec): number
    tick(dt: number): void
    draw(ctx: CanvasRenderingContext2D): void
  }
  // emitters.ts (each calls system.emit and returns nothing)
  burst(sys, x, y, colors, scale = 1)
  fountain(sys, x, y, colors, scale = 1)
  firework(sys, x, startY, targetY, colors, scale = 1)
  confetti(sys, width, colors, scale = 1)
  flames(sys, width, height, heat, dt)
  steam(sys, width, height, scale = 1)
  // presets.ts
  moodPalette(mood: Mood, base: string): string[]
  effectiveIntensity(intensity: Intensity, reducedMotion: boolean): Intensity
  intensityScale(intensity: Intensity): number      // full 1, medium 0.6, calm 0.25
  // heat.ts
  heatColor(heat: number): string                   // 'rgb(r, g, b)'
  heatVars(heat: number): Record<string, string>    // { '--heat', '--heat-color', '--heat-glow' }
  ```

- [ ] **Step 1: Write failing tests**

`src/celebrations/particles.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { mulberry32 } from '../core/engine/rng'
import { ParticleSystem, type EmitSpec } from './particles'

const spec = (over: Partial<EmitSpec> = {}): EmitSpec => ({
  x: 0, y: 0, count: 10, speed: [1, 1], angle: [0, 0], life: [1, 1], size: [2, 2],
  colors: ['#fff'], gravity: 0, drag: 0, ...over,
})

describe('ParticleSystem', () => {
  it('emits up to the cap', () => {
    const sys = new ParticleSystem(15, mulberry32(1))
    expect(sys.emit(spec())).toBe(10)
    expect(sys.emit(spec())).toBe(5)
    expect(sys.count).toBe(15)
  })

  it('moves particles by velocity, applies gravity and drag, and ages them', () => {
    const sys = new ParticleSystem(10, mulberry32(1))
    sys.emit(spec({ count: 1, speed: [10, 10], angle: [0, 0], gravity: 100, drag: 0.5, life: [2, 2] }))
    sys.tick(0.1)
    const p = sys.particles[0]
    expect(p.x).toBeCloseTo(1)
    expect(p.vy).toBeCloseTo(10)
    expect(p.vx).toBeCloseTo(10 * (1 - 0.5 * 0.1))
    expect(p.life).toBeCloseTo(1.9)
  })

  it('removes dead particles and fires onDeath once', () => {
    const sys = new ParticleSystem(10, mulberry32(1))
    const onDeath = vi.fn()
    sys.emit(spec({ count: 2, life: [0.5, 0.5], onDeath }))
    sys.tick(0.4)
    expect(sys.count).toBe(2)
    sys.tick(0.2)
    expect(sys.count).toBe(0)
    expect(onDeath).toHaveBeenCalledTimes(2)
  })

  it('trail particles spawn short-lived sparks behind them', () => {
    const sys = new ParticleSystem(100, mulberry32(1))
    sys.emit(spec({ count: 1, trail: true, life: [1, 1] }))
    sys.tick(0.05)
    expect(sys.count).toBeGreaterThan(1)
    expect(sys.particles.filter((p) => !p.trail).length).toBe(1)
  })

  it('setMax trims the population', () => {
    const sys = new ParticleSystem(50, mulberry32(1))
    sys.emit(spec({ count: 50 }))
    sys.setMax(20)
    sys.tick(0)
    expect(sys.count).toBeLessThanOrEqual(20)
  })

  it('draws every particle', () => {
    const sys = new ParticleSystem(10, mulberry32(1))
    sys.emit(spec({ count: 3, shape: 'circle' }))
    sys.emit(spec({ count: 2, shape: 'rect' }))
    sys.emit(spec({ count: 1, shape: 'spark' }))
    const ctx = {
      save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), beginPath: vi.fn(),
      arc: vi.fn(), fill: vi.fn(), fillRect: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
      fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1,
    } as unknown as CanvasRenderingContext2D
    sys.draw(ctx)
    expect(ctx.arc).toHaveBeenCalledTimes(3)
    expect(ctx.fillRect).toHaveBeenCalledTimes(2)
    expect(ctx.stroke).toHaveBeenCalledTimes(1)
  })
})
```

`src/celebrations/emitters.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../core/engine/rng'
import { burst, confetti, firework, flames, fountain, steam } from './emitters'
import { ParticleSystem } from './particles'

const sys = () => new ParticleSystem(5000, mulberry32(2))

describe('emitters', () => {
  it('burst scales with intensity', () => {
    const a = sys()
    burst(a, 0, 0, ['#f00'], 1)
    const b = sys()
    burst(b, 0, 0, ['#f00'], 0.25)
    expect(a.count).toBeGreaterThan(b.count)
    expect(b.count).toBeGreaterThan(0)
  })

  it('fountain particles start moving upward', () => {
    const s = sys()
    fountain(s, 100, 500, ['#0f0'])
    expect(s.particles.every((p) => p.vy < 0)).toBe(true)
  })

  it('firework launches one rocket whose death blooms', () => {
    const s = sys()
    firework(s, 200, 800, 200, ['#00f'])
    expect(s.count).toBe(1)
    expect(s.particles[0].trail).toBe(true)
    for (let i = 0; i < 100 && s.particles.some((p) => p.onDeath); i++) s.tick(0.05)
    expect(s.count).toBeGreaterThan(30)
  })

  it('confetti spawns across the top and falls', () => {
    const s = sys()
    confetti(s, 400, ['#fff'])
    expect(s.particles.every((p) => p.y <= 0 && p.x >= 0 && p.x <= 400)).toBe(true)
    expect(s.particles.every((p) => p.gravity > 0)).toBe(true)
  })

  it('flames emit proportionally to heat and dt, nothing when cold', () => {
    const cold = sys()
    flames(cold, 400, 800, 0, 0.016)
    expect(cold.count).toBe(0)
    const warm = sys()
    for (let i = 0; i < 60; i++) flames(warm, 400, 800, 0.5, 0.016)
    const hot = sys()
    for (let i = 0; i < 60; i++) flames(hot, 400, 800, 1, 0.016)
    expect(hot.count).toBeGreaterThan(warm.count)
    expect(warm.count).toBeGreaterThan(0)
    expect(hot.particles.every((p) => p.y >= 800 - 5 && p.vy < 0)).toBe(true)
  })

  it('steam rises from the edges', () => {
    const s = sys()
    steam(s, 400, 800)
    expect(s.count).toBeGreaterThan(0)
    expect(s.particles.every((p) => p.vy < 0)).toBe(true)
  })
})
```

`src/celebrations/presets.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { effectiveIntensity, intensityScale, moodPalette } from './presets'

describe('presets', () => {
  it('reduced motion forces calm', () => {
    expect(effectiveIntensity('full', true)).toBe('calm')
    expect(effectiveIntensity('full', false)).toBe('full')
    expect(effectiveIntensity('medium', false)).toBe('medium')
  })
  it('scales by intensity', () => {
    expect(intensityScale('full')).toBe(1)
    expect(intensityScale('medium')).toBe(0.6)
    expect(intensityScale('calm')).toBe(0.25)
  })
  it('palettes include the chord color and differ by mood', () => {
    expect(moodPalette('bright', '#e53935')).toContain('#e53935')
    expect(moodPalette('night', '#212121')).not.toEqual(moodPalette('bright', '#212121'))
    expect(moodPalette('night', '#212121').length).toBeGreaterThanOrEqual(3)
  })
})
```

`src/celebrations/heat.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { heatColor, heatVars } from './heat'

describe('heat', () => {
  it('interpolates amber -> orange -> white-hot', () => {
    expect(heatColor(0)).toBe('rgb(255, 179, 0)')
    expect(heatColor(1)).toBe('rgb(255, 250, 235)')
    const mid = heatColor(0.5)
    expect(mid).toMatch(/^rgb\(255, \d+, \d+\)$/)
    expect(mid).not.toBe(heatColor(0))
  })
  it('exposes CSS variables', () => {
    const vars = heatVars(0.4)
    expect(vars['--heat']).toBe('0.4')
    expect(vars['--heat-color']).toBe(heatColor(0.4))
    expect(vars['--heat-glow']).toMatch(/px/)
  })
  it('clamps', () => {
    expect(heatVars(3)['--heat']).toBe('1')
    expect(heatVars(-1)['--heat']).toBe('0')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/celebrations
```

- [ ] **Step 3: Implement**

`src/celebrations/particles.ts`:
```ts
import type { Rng } from '../core/engine/rng'

export type Shape = 'circle' | 'rect' | 'spark'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  shape: Shape
  gravity: number
  drag: number
  rotation: number
  spin: number
  trail: boolean
  onDeath: ((p: Particle) => void) | null
}

export interface EmitSpec {
  x: number
  y: number
  count: number
  speed: [number, number]
  angle: [number, number]
  life: [number, number]
  size: [number, number]
  colors: string[]
  gravity?: number
  drag?: number
  shape?: Shape
  trail?: boolean
  onDeath?: (p: Particle) => void
}

const TRAIL_EVERY_S = 0.02
const TRAIL_LIFE_S = 0.3

export class ParticleSystem {
  readonly particles: Particle[] = []
  private max: number
  private trailClock = 0
  constructor(max = 1500, private rng: Rng = Math.random) {
    this.max = max
  }

  get count(): number {
    return this.particles.length
  }

  setMax(n: number): void {
    this.max = n
  }

  private range([min, max]: [number, number]): number {
    return min + (max - min) * this.rng()
  }

  emit(spec: EmitSpec): number {
    const room = Math.max(0, this.max - this.particles.length)
    const n = Math.min(room, spec.count)
    for (let i = 0; i < n; i++) {
      const speed = this.range(spec.speed)
      const angle = this.range(spec.angle)
      const life = this.range(spec.life)
      this.particles.push({
        x: spec.x,
        y: spec.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: this.range(spec.size),
        color: spec.colors[Math.floor(this.rng() * spec.colors.length)],
        shape: spec.shape ?? 'circle',
        gravity: spec.gravity ?? 0,
        drag: spec.drag ?? 0,
        rotation: this.rng() * Math.PI * 2,
        spin: (this.rng() - 0.5) * 6,
        trail: spec.trail ?? false,
        onDeath: spec.onDeath ?? null,
      })
    }
    return n
  }

  tick(dt: number): void {
    const dead: Particle[] = []
    for (const p of this.particles) {
      p.vy += p.gravity * dt
      p.vx *= 1 - p.drag * dt
      p.vy *= 1 - p.drag * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rotation += p.spin * dt
      p.life -= dt
      if (p.life <= 0) dead.push(p)
    }
    if (dead.length) {
      const deadSet = new Set(dead)
      let w = 0
      for (const p of this.particles) if (!deadSet.has(p)) this.particles[w++] = p
      this.particles.length = w
      for (const p of dead) p.onDeath?.(p)
    }
    if (this.particles.length > this.max) this.particles.length = this.max

    this.trailClock += dt
    if (this.trailClock >= TRAIL_EVERY_S) {
      this.trailClock = 0
      for (const p of [...this.particles]) {
        if (!p.trail) continue
        this.emit({
          x: p.x, y: p.y, count: 1, speed: [0, 5], angle: [0, Math.PI * 2],
          life: [TRAIL_LIFE_S, TRAIL_LIFE_S], size: [p.size * 0.5, p.size * 0.5],
          colors: [p.color], shape: 'spark', gravity: 30,
        })
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife))
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.fillStyle = p.color
      ctx.strokeStyle = p.color
      if (p.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(0, 0, p.size, 0, Math.PI * 2)
        ctx.fill()
      } else if (p.shape === 'rect') {
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size)
      } else {
        ctx.lineWidth = Math.max(1, p.size * 0.5)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(-p.vx * 0.03, -p.vy * 0.03)
        ctx.stroke()
      }
      ctx.restore()
    }
  }
}
```

`src/celebrations/emitters.ts`:
```ts
import type { ParticleSystem } from './particles'

const UP = -Math.PI / 2

export function burst(sys: ParticleSystem, x: number, y: number, colors: string[], scale = 1): void {
  sys.emit({
    x, y, count: Math.round(40 * scale), speed: [120, 420], angle: [0, Math.PI * 2],
    life: [0.5, 1.1], size: [3, 7], colors, gravity: 500, drag: 1.5,
  })
}

export function fountain(sys: ParticleSystem, x: number, y: number, colors: string[], scale = 1): void {
  sys.emit({
    x, y, count: Math.round(60 * scale), speed: [300, 650], angle: [UP - 0.35, UP + 0.35],
    life: [0.8, 1.6], size: [3, 6], colors, gravity: 700, drag: 0.4,
  })
}

export function firework(
  sys: ParticleSystem, x: number, startY: number, targetY: number, colors: string[], scale = 1,
): void {
  const flight = 0.9
  const speed = (startY - targetY) / flight
  sys.emit({
    x, y: startY, count: 1, speed: [speed, speed], angle: [UP, UP], life: [flight, flight],
    size: [3, 3], colors, trail: true,
    onDeath: (p) => {
      sys.emit({
        x: p.x, y: p.y, count: Math.round(90 * scale), speed: [150, 380], angle: [0, Math.PI * 2],
        life: [0.9, 1.8], size: [2, 5], colors, gravity: 220, drag: 1.2, trail: scale >= 1,
      })
    },
  })
}

export function confetti(sys: ParticleSystem, width: number, colors: string[], scale = 1): void {
  const count = Math.round(120 * scale)
  for (let i = 0; i < count; i++) {
    sys.emit({
      x: (width * i) / count, y: -10, count: 1, speed: [40, 140], angle: [Math.PI / 4, (3 * Math.PI) / 4],
      life: [2.5, 4], size: [4, 8], colors, gravity: 160, drag: 0.8, shape: 'rect',
    })
  }
}

/** Continuous emitter: call every frame with the frame's dt. */
export function flames(sys: ParticleSystem, width: number, height: number, heat: number, dt: number): void {
  if (heat <= 0) return
  const perSecond = 300 * heat * heat
  const count = Math.floor(perSecond * dt + (Math.random() < (perSecond * dt) % 1 ? 1 : 0))
  if (count <= 0) return
  for (let i = 0; i < count; i++) {
    sys.emit({
      x: Math.random() * width, y: height, count: 1, speed: [80 + 200 * heat, 160 + 320 * heat],
      angle: [UP - 0.25, UP + 0.25], life: [0.5, 1.0 + heat], size: [3, 6 + 6 * heat],
      colors: heat > 0.8 ? ['#fff3d6', '#ffd166', '#ff8c42'] : ['#ffb300', '#ff7a00', '#ff3d00'],
      gravity: -80, drag: 1.0, shape: 'circle',
    })
  }
}

export function steam(sys: ParticleSystem, width: number, height: number, scale = 1): void {
  const count = Math.round(30 * scale)
  for (let i = 0; i < count; i++) {
    const left = i % 2 === 0
    sys.emit({
      x: left ? 0 : width, y: height * (0.2 + 0.6 * (i / count)), count: 1, speed: [30, 90],
      angle: [UP - 0.6, UP + 0.6], life: [0.8, 1.4], size: [6, 14],
      colors: ['rgba(200,210,220,0.8)', 'rgba(230,235,240,0.7)'], gravity: -40, drag: 1.2,
    })
  }
}
```

`src/celebrations/presets.ts`:
```ts
import type { Intensity, Mood } from '../core/types'

const MOOD_EXTRAS: Record<Mood, string[]> = {
  bright: ['#fff59d', '#ffffff', '#ffd54f'],
  calm: ['#b3e5fc', '#ffffff', '#80deea'],
  night: ['#7986cb', '#c5cae9', '#fff9c4'],
  sad: ['#90a4ae', '#b0bec5', '#cfd8dc'],
  mysterious: ['#ba68c8', '#4dd0e1', '#ffffff'],
}

export function moodPalette(mood: Mood, base: string): string[] {
  return [base, ...MOOD_EXTRAS[mood]]
}

export function effectiveIntensity(intensity: Intensity, reducedMotion: boolean): Intensity {
  return reducedMotion ? 'calm' : intensity
}

export function intensityScale(intensity: Intensity): number {
  return intensity === 'full' ? 1 : intensity === 'medium' ? 0.6 : 0.25
}
```

`src/celebrations/heat.ts`:
```ts
const STOPS: [number, [number, number, number]][] = [
  [0, [255, 179, 0]],
  [0.5, [255, 110, 0]],
  [1, [255, 250, 235]],
]

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export function heatColor(heat: number): string {
  const h = clamp01(heat)
  let i = 0
  while (i < STOPS.length - 2 && h > STOPS[i + 1][0]) i++
  const [t0, a] = STOPS[i]
  const [t1, b] = STOPS[i + 1]
  const t = (h - t0) / (t1 - t0)
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `rgb(${mix(a[0], b[0])}, ${mix(a[1], b[1])}, ${mix(a[2], b[2])})`
}

export function heatVars(heat: number): Record<string, string> {
  const h = clamp01(heat)
  return {
    '--heat': String(h),
    '--heat-color': heatColor(h),
    '--heat-glow': `${Math.round(h * 90)}px`,
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/celebrations
```
Expected: PASS (17 tests). `heatColor(0)` must be exactly `rgb(255, 179, 0)` and `heatColor(1)` exactly `rgb(255, 250, 235)`; both are stop values so no rounding drift.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add particle engine, emitters, mood palettes and heat colors"
```

---

### Task 14: UI shell, styles, profile picker, home

**Files:**
- Create: `src/ui/styles.css`, `src/ui/AudioContext.tsx`, `src/ui/App.tsx`, `src/ui/screens/ProfilePicker.tsx`, `src/ui/screens/Home.tsx`, `src/ui/testing.tsx`
- Modify: `src/main.tsx` (mount providers, expose store for e2e); delete the Task 1 `src/App.tsx`
- Test: `src/ui/App.test.tsx`, `src/ui/screens/Home.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // AudioContext.tsx
  interface AudioServices { player: AudioPlayer; sfx: Sfx }
  AudioProvider({ services?, children })     // default: createTonePlayer() + createToneSfx(), created once
  useAudio(): AudioServices
  // testing.tsx
  resetStore(): void                         // resets the singleton store to EMPTY_SLICE + screen 'profiles'
  renderApp(ui: ReactNode, services?: Partial<AudioServices>)  // RTL render inside AudioProvider with null player/sfx
  ```
- Screens read and write the `useAppStore` singleton directly. Screen names come from `Screen` in the store.
- Every screen root carries `data-screen="<name>"` for tests.
- `main.tsx` sets `window.__earTrainer = useAppStore` (used by the Playwright smoke test to read the current chord).

- [ ] **Step 1: Write `src/ui/styles.css`**

Mobile-first, big touch targets, system rounded font stack. Heat variables are consumed here.

```css
:root {
  --bg: #fffaf3;
  --ink: #2b2b2b;
  --muted: #7a7a7a;
  --card: #ffffff;
  --accent: #ff7043;
  --accent-ink: #ffffff;
  --radius: 20px;
  --heat: 0;
  --heat-color: rgb(255, 179, 0);
  --heat-glow: 0px;
  font-family: ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif;
}

* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  background: var(--bg);
  color: var(--ink);
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
  user-select: none;
}
button { font: inherit; color: inherit; }

.screen {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
  gap: 16px;
  position: relative;
}
.screen-title { font-size: 1.6rem; margin: 0; text-align: center; }
.muted { color: var(--muted); }
.row { display: flex; align-items: center; gap: 12px; }
.grow { flex: 1; }
.center { text-align: center; }

.big-button {
  border: 0;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 1.6rem;
  font-weight: 800;
  padding: 22px 40px;
  box-shadow: 0 8px 0 #d84315;
  cursor: pointer;
}
.big-button:active { transform: translateY(6px); box-shadow: 0 2px 0 #d84315; }
.big-button.secondary { background: #90a4ae; box-shadow: 0 8px 0 #607d8b; }
.big-button.secondary:active { box-shadow: 0 2px 0 #607d8b; }

.icon-button {
  border: 0; background: var(--card); border-radius: 50%; width: 48px; height: 48px;
  font-size: 1.4rem; box-shadow: 0 2px 6px rgba(0,0,0,.12); cursor: pointer;
}

.card { background: var(--card); border-radius: var(--radius); padding: 16px; box-shadow: 0 2px 10px rgba(0,0,0,.06); }

/* profile picker */
.profile-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
.profile-tile {
  border: 0; border-radius: var(--radius); background: var(--card); padding: 20px 12px;
  font-size: 1.1rem; font-weight: 700; display: flex; flex-direction: column; align-items: center; gap: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,.08); cursor: pointer;
}
.profile-tile .avatar { font-size: 3rem; }
.emoji-choices { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.emoji-choice { font-size: 2rem; border: 3px solid transparent; border-radius: 12px; background: #f3f3f3; padding: 8px; cursor: pointer; }
.emoji-choice[aria-pressed="true"] { border-color: var(--accent); }
.text-input { font-size: 1.2rem; padding: 12px; border-radius: 12px; border: 2px solid #ddd; width: 100%; }

/* home */
.character-strip { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.character-chip {
  width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-size: 2rem;
  border: 4px solid var(--chip-color); background: #fff; position: relative;
}
.character-chip.napping { filter: grayscale(.6); opacity: .7; }
.character-chip.napping::after { content: '💤'; position: absolute; top: -8px; right: -8px; font-size: 1rem; }
.stars { font-size: 1.3rem; font-weight: 800; }
.badge { display: inline-block; background: #fff3cd; border-radius: 999px; padding: 6px 12px; font-weight: 700; }

/* session */
.session { box-shadow: inset 0 0 var(--heat-glow) var(--heat-color); transition: box-shadow .4s ease; }
.tile-grid { display: grid; gap: 12px; flex: 1; align-content: center; }
.tile-grid[data-cols="2"] { grid-template-columns: repeat(2, 1fr); }
.tile-grid[data-cols="3"] { grid-template-columns: repeat(3, 1fr); }
.tile-grid[data-cols="4"] { grid-template-columns: repeat(4, 1fr); }
.tile {
  border: 0; border-radius: var(--radius); background: var(--tile-color); aspect-ratio: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  font-size: clamp(2rem, 10vw, 3.5rem); cursor: pointer; position: relative;
  box-shadow: 0 6px 0 rgba(0,0,0,.18), 0 0 calc(var(--heat-glow) * .4) var(--heat-color);
  transition: transform .15s ease, box-shadow .3s ease;
}
.tile:active { transform: translateY(4px); box-shadow: 0 2px 0 rgba(0,0,0,.18); }
.tile .label { font-size: 1rem; font-weight: 800; color: rgba(255,255,255,.9); text-shadow: 0 1px 2px rgba(0,0,0,.4); }
.tile.napping { filter: grayscale(.7); opacity: .55; cursor: default; }
.tile.napping::after { content: '💤'; position: absolute; top: 6px; right: 8px; font-size: 1.2rem; }
.tile.pop { animation: pop .5s ease; }
.tile.shake { animation: shake .4s ease; }
.tile.pulse { animation: pulse .8s ease infinite; }
.tile.highlight { outline: 6px solid #fff; transform: scale(1.06); }
.tile[disabled] { cursor: default; }
@keyframes pop { 0% { transform: scale(1); } 40% { transform: scale(1.15); } 100% { transform: scale(1); } }
@keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }

.streak-badge {
  position: absolute; top: 12px; right: 64px; font-weight: 900; font-size: 1.4rem; padding: 6px 14px;
  border-radius: 999px; background: var(--heat-color); color: #3a1a00; transition: transform .2s;
}
.streak-badge.hot { transform: scale(1.15); animation: pulse 1s ease infinite; }
.streak-badge.blazing { animation: shake .3s ease infinite; color: #fff; text-shadow: 0 0 8px #ff6d00; }

.trail { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.trail .dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid #bbb; }
.trail .dot.correct { background: #66bb6a; border-color: #66bb6a; }
.trail .dot.wrong { border-color: #ef9a9a; }

/* overlays */
.overlay {
  position: fixed; inset: 0; background: rgba(20, 10, 40, .92); color: #fff; display: flex;
  flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 24px; z-index: 20;
  text-align: center;
}
.reveal { font-size: 7rem; animation: bounce 1s ease infinite; cursor: pointer; }
@keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-24px); } }

/* get ready */
.parade { display: flex; gap: 10px; justify-content: center; font-size: 3rem; min-height: 4rem; }
.parade span { animation: popin .5s ease both; }
@keyframes popin { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.listen { font-size: 3rem; animation: pulse 1s ease infinite; }

/* celebration canvas */
.celebration-canvas { position: fixed; inset: 0; pointer-events: none; z-index: 30; }

/* parent */
.settings-section h3 { margin: 0 0 8px; }
.settings-section label { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0; }
.settings-section input[type="number"], .settings-section select { font-size: 1rem; padding: 6px; }
.bar { height: 10px; background: #eee; border-radius: 5px; overflow: hidden; }
.bar > div { height: 100%; background: var(--accent); }
.danger { color: #c62828; }

@media (prefers-reduced-motion: reduce) {
  .tile, .streak-badge, .reveal, .parade span, .listen { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 2: Write `src/ui/AudioContext.tsx`**

```tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { AudioPlayer } from '../audio/player'
import { createToneSfx, type Sfx } from '../audio/sfx'
import { createTonePlayer } from '../audio/tonePlayer'

export interface AudioServices {
  player: AudioPlayer
  sfx: Sfx
}

const Ctx = createContext<AudioServices | null>(null)

export function AudioProvider({ services, children }: { services?: AudioServices; children: ReactNode }) {
  const value = useMemo<AudioServices>(
    () => services ?? { player: createTonePlayer(), sfx: createToneSfx() },
    [services],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAudio(): AudioServices {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAudio outside AudioProvider')
  return v
}
```

- [ ] **Step 3: Write `src/ui/testing.tsx`**

```tsx
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createNullPlayer } from '../audio/player'
import { createNullSfx } from '../audio/sfx'
import { EMPTY_SLICE } from '../state/migrations'
import { useAppStore } from '../state/store'
import { AudioProvider, type AudioServices } from './AudioContext'

export function resetStore(): void {
  window.localStorage.clear()
  useAppStore.setState({ ...EMPTY_SLICE, screen: 'profiles', pendingPrimer: null, storageNotice: null })
}

export function renderApp(ui: ReactNode, services: Partial<AudioServices> = {}) {
  const full: AudioServices = {
    player: services.player ?? createNullPlayer(),
    sfx: services.sfx ?? createNullSfx(),
  }
  return { ...render(<AudioProvider services={full}>{ui}</AudioProvider>), services: full }
}
```

- [ ] **Step 4: Write failing tests**

`src/ui/App.test.tsx`:
```tsx
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../state/store'
import { App } from './App'
import { renderApp, resetStore } from './testing'

beforeEach(resetStore)

describe('App', () => {
  it('shows the profile picker when there are no profiles and creates one', () => {
    renderApp(<App />)
    expect(screen.getByTestId('screen-profiles')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByRole('button', { name: '🐱' }))
    fireEvent.click(screen.getByRole('button', { name: /let's go/i }))
    expect(useAppStore.getState().profiles[0]).toMatchObject({ name: 'Ada', avatarEmoji: '🐱' })
    expect(screen.getByTestId('screen-home')).toBeInTheDocument()
  })

  it('returns to home for a remembered active profile', () => {
    useAppStore.getState().createProfile('Ada', '🐱')
    useAppStore.setState({ screen: 'profiles' })
    renderApp(<App />)
    expect(screen.getByTestId('screen-home')).toBeInTheDocument()
  })

  it('resumes an unfinished session through get-ready', () => {
    useAppStore.getState().createProfile('Ada', '🐱')
    useAppStore.getState().startSession()
    useAppStore.setState({ screen: 'profiles' })
    renderApp(<App />)
    expect(screen.getByTestId('screen-getReady')).toBeInTheDocument()
  })

  it('shows and dismisses a storage notice', () => {
    useAppStore.setState({ storageNotice: 'corrupt' })
    renderApp(<App />)
    expect(screen.getByText(/could not be read/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ok/i }))
    expect(screen.queryByText(/could not be read/i)).toBeNull()
  })
})
```

`src/ui/screens/Home.test.tsx`:
```tsx
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { Home } from './Home'

beforeEach(() => {
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
})

describe('Home', () => {
  it('greets, shows unlocked characters and stars, and starts get-ready on Play', () => {
    useAppStore.setState((s) => ({
      profiles: s.profiles.map((p) => ({ ...p, progression: { ...p.progression, stars: 7 } })),
    }))
    renderApp(<Home />)
    expect(screen.getByText(/hi, ada/i)).toBeInTheDocument()
    expect(screen.getByText('🦁')).toBeInTheDocument()
    expect(screen.getByText('🐥')).toBeInTheDocument()
    expect(screen.queryByText('🐳')).toBeNull()
    expect(screen.getByText(/7/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play/i }))
    expect(useAppStore.getState().screen).toBe('getReady')
  })

  it('marks a napping character and shows the manual-unlock badge', () => {
    useAppStore.getState().parentUnlockNext()
    useAppStore.setState((s) => ({
      profiles: s.profiles.map((p) => ({
        ...p,
        settings: { ...p.settings, pacing: 'manual' },
        progression: { ...p.progression, napping: 'blue', readyForUnlock: true },
      })),
    }))
    renderApp(<Home />)
    expect(screen.getByTitle(/whale is napping/i)).toBeInTheDocument()
    expect(screen.getByText(/ready for a new friend/i)).toBeInTheDocument()
  })

  it('gear goes to parent screen and switch player goes to profiles', () => {
    renderApp(<Home />)
    fireEvent.click(screen.getByRole('button', { name: /grown-ups/i }))
    expect(useAppStore.getState().screen).toBe('parent')
    useAppStore.setState({ screen: 'home' })
    fireEvent.click(screen.getByRole('button', { name: /switch player/i }))
    expect(useAppStore.getState().screen).toBe('profiles')
  })
})
```

- [ ] **Step 5: Run to verify they fail**

```bash
npx vitest run src/ui
```

- [ ] **Step 6: Implement `src/ui/screens/ProfilePicker.tsx`**

```tsx
import { useState } from 'react'
import { useAppStore } from '../../state/store'

const AVATARS = ['🐱', '🐶', '🐰', '🦊', '🐼', '🐨', '🦄', '🐸']

export function ProfilePicker() {
  const profiles = useAppStore((s) => s.profiles)
  const createProfile = useAppStore((s) => s.createProfile)
  const selectProfile = useAppStore((s) => s.selectProfile)
  const importProfile = useAppStore((s) => s.importProfile)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [importError, setImportError] = useState<string | null>(null)

  const canCreate = name.trim().length > 0

  async function onImport(file: File | undefined) {
    if (!file) return
    try {
      importProfile(await file.text())
      setImportError(null)
    } catch {
      setImportError("That file isn't an Ear Trainer profile.")
    }
  }

  return (
    <div className="screen" data-screen="profiles" data-testid="screen-profiles">
      <h1 className="screen-title">Who's playing?</h1>
      {profiles.length > 0 && (
        <div className="profile-grid">
          {profiles.map((p) => (
            <button key={p.id} className="profile-tile" onClick={() => selectProfile(p.id)}>
              <span className="avatar">{p.avatarEmoji}</span>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          if (canCreate) createProfile(name.trim(), avatar)
        }}
      >
        <h2 style={{ marginTop: 0 }}>New player</h2>
        <label>
          <span className="muted">Name</span>
          <input
            className="text-input"
            aria-label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
          />
        </label>
        <div className="emoji-choices" style={{ margin: '12px 0' }}>
          {AVATARS.map((a) => (
            <button
              type="button"
              key={a}
              className="emoji-choice"
              aria-pressed={a === avatar}
              onClick={() => setAvatar(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <button className="big-button" type="submit" disabled={!canCreate} style={{ width: '100%' }}>
          Let's go!
        </button>
      </form>
      <label className="muted center">
        Grown-ups: import a saved profile{' '}
        <input type="file" accept="application/json" onChange={(e) => onImport(e.target.files?.[0])} />
      </label>
      {importError && <p className="danger center">{importError}</p>}
    </div>
  )
}
```

- [ ] **Step 7: Implement `src/ui/screens/Home.tsx`**

```tsx
import type { CSSProperties } from 'react'
import { chordById } from '../../core/content/chords'
import { isChampion, unlockedChordIds } from '../../core/content/curriculum'
import { activeProfile, useAppStore } from '../../state/store'

export function Home() {
  const profile = useAppStore(activeProfile)
  const goTo = useAppStore((s) => s.goTo)
  const selectProfile = useAppStore((s) => s.selectProfile)
  if (!profile) return null
  const { progression } = profile
  const showReady = profile.settings.pacing === 'manual' && progression.readyForUnlock

  return (
    <div className="screen" data-screen="home" data-testid="screen-home">
      <div className="row">
        <button className="icon-button" aria-label="Switch player" onClick={() => selectProfile(null)}>
          {profile.avatarEmoji}
        </button>
        <h1 className="screen-title grow">Hi, {profile.name}!</h1>
        <button className="icon-button" aria-label="Grown-ups" onClick={() => goTo('parent')}>
          ⚙️
        </button>
      </div>

      <p className="stars center">⭐ {progression.stars}</p>
      {isChampion(progression) && <p className="center"><span className="badge">🏆 Grand Champion</span></p>}
      {showReady && <p className="center"><span className="badge">Ready for a new friend! Ask a grown-up.</span></p>}

      <div className="character-strip" aria-label="Your friends">
        {unlockedChordIds(progression.unlocks).map((id) => {
          const chord = chordById(id)
          const napping = progression.napping === id
          return (
            <span
              key={id}
              className={`character-chip${napping ? ' napping' : ''}`}
              style={{ '--chip-color': chord.color } as CSSProperties}
              title={napping ? `${chord.character.name} is napping` : chord.character.name}
            >
              {chord.character.emoji}
            </span>
          )
        })}
      </div>

      <div className="grow" />
      <button className="big-button" onClick={() => goTo('getReady')}>
        ▶ Play
      </button>
    </div>
  )
}
```

- [ ] **Step 8: Implement `src/ui/App.tsx` and `src/main.tsx`**

`App.tsx` references screens from later tasks. Create placeholder components for them now so the app compiles, each rendering its `data-screen` root and nothing else; later tasks replace them:

`src/ui/screens/GetReady.tsx`, `Session.tsx`, `Summary.tsx`, `ParentSettings.tsx` (placeholders):
```tsx
export function GetReady() {
  return <div className="screen" data-screen="getReady" data-testid="screen-getReady" />
}
```
(same shape for `Session` / `session`, `Summary` / `summary`, `ParentSettings` / `parent`.)

`src/ui/App.tsx`:
```tsx
import { useEffect } from 'react'
import { CelebrationLayer } from '../celebrations/CelebrationLayer'
import { useAppStore } from '../state/store'
import { GetReady } from './screens/GetReady'
import { Home } from './screens/Home'
import { ParentSettings } from './screens/ParentSettings'
import { ProfilePicker } from './screens/ProfilePicker'
import { Session } from './screens/Session'
import { Summary } from './screens/Summary'

function StorageNotice() {
  const notice = useAppStore((s) => s.storageNotice)
  const dismiss = useAppStore((s) => s.dismissNotice)
  if (!notice) return null
  const text =
    notice === 'corrupt'
      ? 'Saved progress could not be read. A backup was kept and the app started fresh.'
      : 'Progress could not be saved on this device. Check free space or private-browsing settings.'
  return (
    <div className="card" role="alert" style={{ margin: 12 }}>
      <p>{text}</p>
      <button className="big-button secondary" onClick={dismiss}>OK</button>
    </div>
  )
}

export function App() {
  const screen = useAppStore((s) => s.screen)
  const goTo = useAppStore((s) => s.goTo)

  useEffect(() => {
    const { session, activeProfileId } = useAppStore.getState()
    if (!activeProfileId) return
    if (session && session.phase !== 'summary') goTo('getReady')
    else if (session && session.phase === 'summary') goTo('summary')
    else goTo('home')
    // Runs once: routes a rehydrated store to the right screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <StorageNotice />
      {screen === 'profiles' && <ProfilePicker />}
      {screen === 'home' && <Home />}
      {screen === 'getReady' && <GetReady />}
      {screen === 'session' && <Session />}
      {screen === 'summary' && <Summary />}
      {screen === 'parent' && <ParentSettings />}
      <CelebrationLayer />
    </>
  )
}
```

`src/celebrations/CelebrationLayer.tsx` placeholder (replaced in Task 18):
```tsx
export function CelebrationLayer() {
  return null
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useAppStore } from './state/store'
import { App } from './ui/App'
import { AudioProvider } from './ui/AudioContext'
import './ui/styles.css'

declare global {
  interface Window {
    __earTrainer: typeof useAppStore
  }
}
window.__earTrainer = useAppStore

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AudioProvider>
      <App />
    </AudioProvider>
  </StrictMode>,
)
```

Delete the Task 1 `src/App.tsx`.

- [ ] **Step 9: Run tests, typecheck, lint, dev-smoke**

```bash
npx vitest run src/ui && npm run typecheck && npm run lint
```
Expected: PASS (7 tests). Then `npm run dev`, open the URL on a phone-sized viewport, create a profile, confirm the home screen renders with two characters and Play switches to the (empty) get-ready screen.

The `oxlint` rule name in the `eslint-disable` comment may differ; if lint flags the comment, remove it (oxlint does not enforce exhaustive-deps by default).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add UI shell, styles, profile picker and home screen"
```

---

### Task 15: Parent gate and parent settings

**Files:**
- Create: `src/ui/screens/ParentGate.tsx`, replace placeholder `src/ui/screens/ParentSettings.tsx`
- Test: `src/ui/screens/ParentGate.test.tsx`, `src/ui/screens/ParentSettings.test.tsx`

**Interfaces:**
- Produces: `ParentGate({ onPass }: { onPass: () => void })`, `ParentSettings()`.
- `ParentGate` shows `a × b = ?` with `a, b ∈ [2, 9]`, input type number, "Go" button. Wrong answer → new question, "Try again" text.

- [ ] **Step 1: Write failing tests**

`src/ui/screens/ParentGate.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ParentGate } from './ParentGate'

function readQuestion(): number {
  const m = /(\d) × (\d)/.exec(screen.getByTestId('gate-question').textContent ?? '')!
  return Number(m[1]) * Number(m[2])
}

describe('ParentGate', () => {
  it('passes on the right product', () => {
    const onPass = vi.fn()
    render(<ParentGate onPass={onPass} />)
    fireEvent.change(screen.getByLabelText(/answer/i), { target: { value: String(readQuestion()) } })
    fireEvent.click(screen.getByRole('button', { name: /go/i }))
    expect(onPass).toHaveBeenCalledTimes(1)
  })

  it('rejects a wrong answer and asks again', () => {
    const onPass = vi.fn()
    render(<ParentGate onPass={onPass} />)
    fireEvent.change(screen.getByLabelText(/answer/i), { target: { value: String(readQuestion() + 1) } })
    fireEvent.click(screen.getByRole('button', { name: /go/i }))
    expect(onPass).not.toHaveBeenCalled()
    expect(screen.getByText(/try again/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/answer/i)).toHaveValue(null)
  })
})
```

`src/ui/screens/ParentSettings.test.tsx`:
```tsx
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activeProfile, useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { ParentSettings } from './ParentSettings'

function passGate() {
  const m = /(\d) × (\d)/.exec(screen.getByTestId('gate-question').textContent ?? '')!
  fireEvent.change(screen.getByLabelText(/answer/i), { target: { value: String(Number(m[1]) * Number(m[2])) } })
  fireEvent.click(screen.getByRole('button', { name: /go/i }))
}

beforeEach(() => {
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
  useAppStore.setState({ screen: 'parent' })
})

describe('ParentSettings', () => {
  it('is gated', () => {
    renderApp(<ParentSettings />)
    expect(screen.queryByText(/progression/i)).toBeNull()
    passGate()
    expect(screen.getByText(/progression/i)).toBeInTheDocument()
  })

  it('edits pacing, target and instrument', () => {
    renderApp(<ParentSettings />)
    passGate()
    fireEvent.click(screen.getByLabelText(/eguchi/i))
    fireEvent.change(screen.getByLabelText(/days between/i), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText(/questions per session/i), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText(/instrument/i), { target: { value: 'harp' } })
    const s = activeProfile(useAppStore.getState())!.settings
    expect(s.pacing).toBe('eguchi')
    expect(s.pacingParams.eguchiDays).toBe(7)
    expect(s.sessionTarget).toBe(30)
    expect(s.instrumentId).toBe('harp')
  })

  it('unlocks, wakes, rewinds and resets with confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp(<ParentSettings />)
    passGate()
    fireEvent.click(screen.getByRole('button', { name: /unlock next/i }))
    expect(activeProfile(useAppStore.getState())!.progression.unlocks).toHaveLength(3)
    useAppStore.setState((st) => ({
      profiles: st.profiles.map((p) => ({ ...p, progression: { ...p.progression, napping: 'blue' } })),
    }))
    expect(screen.getByText(/whale is napping/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /wake now/i }))
    expect(activeProfile(useAppStore.getState())!.progression.napping).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /rewind a level/i }))
    expect(activeProfile(useAppStore.getState())!.progression.unlocks).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /reset progress/i }))
    expect(window.confirm).toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('shows per-chord stats and goes back home', () => {
    useAppStore.setState((st) => ({
      profiles: st.profiles.map((p) => ({
        ...p,
        progression: { ...p.progression, chordStats: { red: { attempts: 10, correct: 8 } }, bestStreak: 6 },
      })),
    }))
    renderApp(<ParentSettings />)
    passGate()
    expect(screen.getByText(/lion/i)).toBeInTheDocument()
    expect(screen.getByText(/8 \/ 10/)).toBeInTheDocument()
    expect(screen.getByText(/best streak/i).textContent).toMatch(/6/)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(useAppStore.getState().screen).toBe('home')
  })

  it('deletes the profile after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp(<ParentSettings />)
    passGate()
    fireEvent.click(screen.getByRole('button', { name: /delete profile/i }))
    expect(useAppStore.getState().profiles).toHaveLength(0)
    expect(useAppStore.getState().screen).toBe('profiles')
    vi.restoreAllMocks()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/ui/screens/ParentGate.test.tsx src/ui/screens/ParentSettings.test.tsx
```

- [ ] **Step 3: Implement `src/ui/screens/ParentGate.tsx`**

```tsx
import { useState } from 'react'

function question() {
  const a = 2 + Math.floor(Math.random() * 8)
  const b = 2 + Math.floor(Math.random() * 8)
  return { a, b }
}

export function ParentGate({ onPass }: { onPass: () => void }) {
  const [q, setQ] = useState(question)
  const [value, setValue] = useState('')
  const [failed, setFailed] = useState(false)

  function submit() {
    if (Number(value) === q.a * q.b) {
      onPass()
      return
    }
    setFailed(true)
    setQ(question())
    setValue('')
  }

  return (
    <div className="screen" data-screen="parent" data-testid="screen-parent">
      <h1 className="screen-title">Grown-ups only</h1>
      <form
        className="card center"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <p data-testid="gate-question" style={{ fontSize: '2rem', margin: '8px 0' }}>
          {q.a} × {q.b} = ?
        </p>
        <input
          className="text-input"
          type="number"
          inputMode="numeric"
          aria-label="Answer"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {failed && <p className="muted">Try again</p>}
        <button className="big-button" type="submit" style={{ marginTop: 12 }}>
          Go
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Implement `src/ui/screens/ParentSettings.tsx`**

```tsx
import { useState } from 'react'
import { chordById } from '../../core/content/chords'
import { levelOf, nextChordId, unlockedChordIds } from '../../core/content/curriculum'
import { INSTRUMENTS } from '../../core/content/instruments'
import { PACING_LIMITS } from '../../core/engine/pacing'
import type { Intensity, PacingParams, PacingPolicyId } from '../../core/types'
import { exportProfile } from '../../state/exportImport'
import { SESSION_TARGET_LIMITS } from '../../state/profile'
import { activeProfile, useAppStore } from '../../state/store'
import { ParentGate } from './ParentGate'

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ParentSettings() {
  const [passed, setPassed] = useState(false)
  if (!passed) return <ParentGate onPass={() => setPassed(true)} />
  return <SettingsBody />
}

function SettingsBody() {
  const profile = useAppStore(activeProfile)
  const session = useAppStore((s) => s.session)
  const goTo = useAppStore((s) => s.goTo)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const parentUnlockNext = useAppStore((s) => s.parentUnlockNext)
  const parentWake = useAppStore((s) => s.parentWake)
  const parentRewind = useAppStore((s) => s.parentRewind)
  const parentResetProgress = useAppStore((s) => s.parentResetProgress)
  const deleteProfile = useAppStore((s) => s.deleteProfile)
  const importProfile = useAppStore((s) => s.importProfile)
  const [importError, setImportError] = useState<string | null>(null)
  if (!profile) return null
  const { settings, progression } = profile

  const setParam = (key: keyof PacingParams, raw: string) =>
    updateSettings({ pacingParams: { ...settings.pacingParams, [key]: Number(raw) } })

  const numberField = (label: string, key: keyof PacingParams) => (
    <label>
      {label}
      <input
        type="number"
        aria-label={label}
        min={PACING_LIMITS[key][0]}
        max={PACING_LIMITS[key][1]}
        value={settings.pacingParams[key]}
        onChange={(e) => setParam(key, e.target.value)}
      />
    </label>
  )

  const nappingChord = progression.napping ? chordById(progression.napping) : null
  const next = nextChordId(progression.unlocks)
  const recentSessions = progression.sessions.slice(-10).reverse()

  return (
    <div className="screen" data-screen="parent" data-testid="screen-parent">
      <div className="row">
        <button className="icon-button" aria-label="Back" onClick={() => goTo('home')}>←</button>
        <h1 className="screen-title grow">{profile.avatarEmoji} {profile.name}</h1>
      </div>

      <section className="card settings-section">
        <h3>Progression</h3>
        <p className="muted">Level {levelOf(progression.unlocks)} · {unlockedChordIds(progression.unlocks).length} chords unlocked</p>
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend className="muted">Pacing</legend>
          {(['unlimited', 'eguchi', 'manual'] as PacingPolicyId[]).map((id) => (
            <label key={id} style={{ justifyContent: 'flex-start' }}>
              <input type="radio" name="pacing" checked={settings.pacing === id} onChange={() => updateSettings({ pacing: id })} />
              {id === 'unlimited' ? 'Unlimited (streak unlocks)' : id === 'eguchi' ? 'Eguchi (spaced, 100%)' : 'Manual (parent unlocks)'}
            </label>
          ))}
        </fieldset>
        {settings.pacing === 'unlimited' && numberField('Correct in a row to unlock', 'streakTarget')}
        {settings.pacing === 'eguchi' && (
          <>
            {numberField('Perfect answers in a row (window)', 'eguchiWindow')}
            {numberField('Days between unlocks', 'eguchiDays')}
            {numberField('Sessions between unlocks', 'eguchiSessions')}
          </>
        )}
        <label>
          Questions per session
          <input
            type="number"
            aria-label="Questions per session"
            min={SESSION_TARGET_LIMITS[0]}
            max={SESSION_TARGET_LIMITS[1]}
            value={settings.sessionTarget}
            onChange={(e) => updateSettings({ sessionTarget: Number(e.target.value) })}
          />
        </label>
        {progression.readyForUnlock && <p className="badge">Ready to unlock</p>}
        {nappingChord && <p>{nappingChord.character.emoji} {nappingChord.character.name} is napping</p>}
        {session && session.phase !== 'summary' && (
          <p className="muted">Session in progress · working set {session.workingSet.size} of {unlockedChordIds(progression.unlocks).length - (progression.napping ? 1 : 0)}</p>
        )}
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="big-button secondary" disabled={!next} onClick={parentUnlockNext}>Unlock next</button>
          <button className="big-button secondary" disabled={!nappingChord} onClick={parentWake}>Wake now</button>
          <button className="big-button secondary" disabled={progression.unlocks.length <= 2} onClick={parentRewind}>Rewind a level</button>
          <button
            className="big-button secondary"
            onClick={() => window.confirm('Reset all progress for this player?') && parentResetProgress()}
          >
            Reset progress
          </button>
        </div>
      </section>

      <section className="card settings-section">
        <h3>Sound &amp; look</h3>
        <label>
          Instrument
          <select aria-label="Instrument" value={settings.instrumentId} onChange={(e) => updateSettings({ instrumentId: e.target.value })}>
            {INSTRUMENTS.map((i) => <option key={i.id} value={i.id}>{i.emoji} {i.name}</option>)}
          </select>
        </label>
        <label>
          Show chord letters
          <input type="checkbox" checked={settings.showLetters} onChange={(e) => updateSettings({ showLetters: e.target.checked })} />
        </label>
        <label>
          Celebration intensity
          <select aria-label="Celebration intensity" value={settings.intensity} onChange={(e) => updateSettings({ intensity: e.target.value as Intensity })}>
            <option value="full">Full</option>
            <option value="medium">Medium</option>
            <option value="calm">Calm</option>
          </select>
        </label>
        <label>
          Celebration sounds
          <input type="checkbox" checked={settings.celebrationSound} onChange={(e) => updateSettings({ celebrationSound: e.target.checked })} />
        </label>
        <label>
          Vibration
          <input type="checkbox" checked={settings.haptics} onChange={(e) => updateSettings({ haptics: e.target.checked })} />
        </label>
      </section>

      <section className="card settings-section">
        <h3>Stats</h3>
        <p>Best streak: {progression.bestStreak} · Stars: {progression.stars}</p>
        {unlockedChordIds(progression.unlocks).map((id) => {
          const chord = chordById(id)
          const st = progression.chordStats[id] ?? { attempts: 0, correct: 0 }
          const pct = st.attempts ? Math.round((100 * st.correct) / st.attempts) : 0
          return (
            <div key={id} style={{ margin: '6px 0' }}>
              <div className="row">
                <span>{chord.character.emoji} {chord.character.name}</span>
                <span className="grow" />
                <span className="muted">{st.correct} / {st.attempts}</span>
              </div>
              <div className="bar"><div style={{ width: `${pct}%`, background: chord.color }} /></div>
            </div>
          )
        })}
        {recentSessions.length > 0 && (
          <>
            <h4>Recent sessions</h4>
            <ul style={{ paddingLeft: 18 }}>
              {recentSessions.map((s) => (
                <li key={s.endedAt}>
                  {new Date(s.endedAt).toLocaleDateString()} · {s.correct}/{s.count} · {'⭐'.repeat(s.stars)}{s.leveledUp ? ' · level up!' : ''}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card settings-section">
        <h3>Data</h3>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="big-button secondary" onClick={() => download(`${profile.name}-ear-trainer.json`, exportProfile(profile))}>
            Export profile
          </button>
          <label className="big-button secondary" style={{ cursor: 'pointer' }}>
            Import profile
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try {
                  importProfile(await f.text())
                  setImportError(null)
                } catch {
                  setImportError("That file isn't an Ear Trainer profile.")
                }
              }}
            />
          </label>
          <button
            className="big-button secondary danger"
            onClick={() => window.confirm(`Delete ${profile.name}? This cannot be undone.`) && deleteProfile(profile.id)}
          >
            Delete profile
          </button>
        </div>
        {importError && <p className="danger">{importError}</p>}
      </section>

      <section className="card settings-section">
        <h3>Credits</h3>
        <ul style={{ paddingLeft: 18 }}>
          {INSTRUMENTS.map((i) => <li key={i.id} className="muted">{i.name}: {i.attribution}</li>)}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/ui/screens
```
Expected: PASS (7 tests). `getByLabelText(/eguchi/i)` matches the radio via its label text; `getByLabelText(/instrument/i)` matches the select's `aria-label`.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npm run typecheck && npm run lint
git add -A
git commit -m "Add parent gate and parent settings screen"
```

---

### Task 16: Session screen, tiles, trail, streak badge, primer

**Files:**
- Create: `src/celebrations/anchors.ts`, `src/ui/hooks/usePrimer.ts`, `src/ui/components/ChordTile.tsx`, `src/ui/components/TileGrid.tsx`, `src/ui/components/ProgressTrail.tsx`, `src/ui/components/StreakBadge.tsx`; replace placeholder `src/ui/screens/Session.tsx`
- Test: `src/ui/hooks/usePrimer.test.tsx`, `src/ui/screens/Session.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // anchors.ts — where tiles are on screen, for particle bursts
  registerAnchor(id: string, el: HTMLElement | null): void
  anchorCenter(id: string): { x: number; y: number } | null
  // usePrimer.ts
  usePrimer(ids: string[] | null, handlers: { onStep(id: string, last: boolean): void; onDone(): void; stepMs?: number }): { activeId: string | null }
  // components
  ChordTile({ chord, showLetters, napping, flash: 'pop' | 'shake' | 'pulse' | 'highlight' | null, disabled, onTap })
  TileGrid({ children, count })            // sets data-cols 2 / 3 / 4 for count ≤4 / ≤9 / more
  ProgressTrail({ answers, target })
  StreakBadge({ streak, heat })            // hidden below 3; classes warm ≥ .33, hot ≥ .66, blazing ≥ 1
  // Session.tsx
  FEEDBACK_MS = 1000
  Session()
  ```
- Session plays the current chord 150 ms after a question appears (not while a primer runs), plays the correct chord once in feedback, and advances after `FEEDBACK_MS` (plus 500 ms after a miss).

- [ ] **Step 1: Write failing tests**

`src/ui/hooks/usePrimer.test.tsx`:
```tsx
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePrimer } from './usePrimer'

function Probe({ ids, onStep, onDone }: { ids: string[] | null; onStep: (id: string, last: boolean) => void; onDone: () => void }) {
  const { activeId } = usePrimer(ids, { onStep, onDone, stepMs: 100 })
  return <div data-testid="active">{activeId ?? ''}</div>
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('usePrimer', () => {
  it('steps through ids, holds the last one longer, then calls onDone', () => {
    const onStep = vi.fn()
    const onDone = vi.fn()
    const { getByTestId } = render(<Probe ids={['a', 'b', 'c']} onStep={onStep} onDone={onDone} />)
    act(() => vi.advanceTimersByTime(0))
    expect(getByTestId('active').textContent).toBe('a')
    act(() => vi.advanceTimersByTime(100))
    expect(getByTestId('active').textContent).toBe('b')
    act(() => vi.advanceTimersByTime(100))
    expect(getByTestId('active').textContent).toBe('c')
    expect(onStep.mock.calls).toEqual([['a', false], ['b', false], ['c', true]])
    act(() => vi.advanceTimersByTime(100))
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(60))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(getByTestId('active').textContent).toBe('')
  })

  it('does nothing for null', () => {
    const onDone = vi.fn()
    render(<Probe ids={null} onStep={vi.fn()} onDone={onDone} />)
    act(() => vi.advanceTimersByTime(1000))
    expect(onDone).not.toHaveBeenCalled()
  })
})
```

`src/ui/screens/Session.test.tsx`:
```tsx
import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chordById } from '../../core/content/chords'
import { activeProfile, useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { FEEDBACK_MS, Session } from './Session'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
})
afterEach(() => vi.useRealTimers())

const current = () => useAppStore.getState().session!.currentChordId!
const tile = (id: string) => screen.getByTestId(`tile-${id}`)

describe('Session', () => {
  it('renders unlocked tiles in curriculum order and plays the question', () => {
    useAppStore.getState().parentUnlockNext()
    useAppStore.getState().startSession()
    const { services } = renderApp(<Session />)
    const tiles = screen.getAllByTestId(/^tile-/)
    expect(tiles.map((t) => t.dataset.chord)).toEqual(['red', 'yellow', 'blue'])
    expect(tile('red')).toHaveStyle({ '--tile-color': '#e53935' })
    expect(screen.getByTestId('tile-grid').dataset.cols).toBe('2')
    act(() => vi.advanceTimersByTime(200))
    const player = services.player as unknown as { played: { notes: string[] }[] }
    expect(player.played[0].notes).toEqual(chordById(current()).notes)
  })

  it('a correct tap pops, replays the chord, then advances', () => {
    useAppStore.getState().startSession()
    const { services } = renderApp(<Session />)
    act(() => vi.advanceTimersByTime(200))
    const asked = current()
    fireEvent.click(tile(asked))
    expect(useAppStore.getState().session!.phase).toBe('feedback')
    expect(tile(asked).className).toMatch(/pop/)
    const player = services.player as unknown as { played: { notes: string[] }[] }
    expect(player.played).toHaveLength(2)
    act(() => vi.advanceTimersByTime(FEEDBACK_MS))
    expect(useAppStore.getState().session!.phase).toBe('question')
    expect(useAppStore.getState().session!.answers).toHaveLength(1)
  })

  it('a wrong tap shakes the tapped tile and pulses the right one', () => {
    useAppStore.getState().startSession()
    renderApp(<Session />)
    const asked = current()
    const wrong = asked === 'red' ? 'yellow' : 'red'
    fireEvent.click(tile(wrong))
    expect(tile(wrong).className).toMatch(/shake/)
    expect(tile(asked).className).toMatch(/pulse/)
    act(() => vi.advanceTimersByTime(FEEDBACK_MS + 500))
    expect(useAppStore.getState().session!.phase).toBe('question')
  })

  it('ignores taps during feedback and on a napping tile', () => {
    useAppStore.getState().parentUnlockNext()
    useAppStore.setState((s) => ({
      profiles: s.profiles.map((p) => ({ ...p, progression: { ...p.progression, napping: 'blue' } })),
    }))
    useAppStore.getState().startSession()
    renderApp(<Session />)
    expect(tile('blue')).toBeDisabled()
    expect(tile('blue').className).toMatch(/napping/)
    fireEvent.click(tile('blue'))
    expect(useAppStore.getState().session!.answers).toHaveLength(0)
    fireEvent.click(tile(current()))
    fireEvent.click(tile(current()))
    expect(useAppStore.getState().session!.answers).toHaveLength(1)
  })

  it('hear again replays, stop ends the session', () => {
    useAppStore.getState().startSession()
    const { services } = renderApp(<Session />)
    act(() => vi.advanceTimersByTime(200))
    fireEvent.click(screen.getByRole('button', { name: /hear it again/i }))
    expect((services.player as unknown as { played: unknown[] }).played).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /stop/i }))
    expect(useAppStore.getState().screen).toBe('summary')
  })

  it('shows the streak badge from 3 and the trail fills', () => {
    useAppStore.getState().updateSettings({ pacing: 'manual' })
    useAppStore.getState().startSession()
    renderApp(<Session />)
    expect(screen.queryByTestId('streak-badge')).toBeNull()
    for (let i = 0; i < 3; i++) {
      fireEvent.click(tile(current()))
      act(() => vi.advanceTimersByTime(FEEDBACK_MS))
    }
    expect(screen.getByTestId('streak-badge').textContent).toContain('3')
    expect(screen.getAllByTestId('trail-dot').filter((d) => d.className.includes('correct'))).toHaveLength(3)
    expect(activeProfile(useAppStore.getState())!.progression.streak).toBe(3)
  })

  it('runs the primer, highlighting tiles in turn and blocking taps', () => {
    useAppStore.getState().parentUnlockNext()
    useAppStore.getState().startSession()
    useAppStore.setState({ pendingPrimer: ['red', 'yellow', 'blue'] })
    renderApp(<Session />)
    act(() => vi.advanceTimersByTime(0))
    expect(tile('red').className).toMatch(/highlight/)
    fireEvent.click(tile(current()))
    expect(useAppStore.getState().session!.answers).toHaveLength(0)
    act(() => vi.advanceTimersByTime(1200))
    expect(tile('yellow').className).toMatch(/highlight/)
    act(() => vi.advanceTimersByTime(1200))
    expect(tile('blue').className).toMatch(/highlight/)
    act(() => vi.advanceTimersByTime(2500))
    expect(useAppStore.getState().pendingPrimer).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/ui/hooks src/ui/screens/Session.test.tsx
```

- [ ] **Step 3: Implement the small pieces**

`src/celebrations/anchors.ts`:
```ts
const anchors = new Map<string, HTMLElement>()

export function registerAnchor(id: string, el: HTMLElement | null): void {
  if (el) anchors.set(id, el)
  else anchors.delete(id)
}

export function anchorCenter(id: string): { x: number; y: number } | null {
  const el = anchors.get(id)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
```

`src/ui/hooks/usePrimer.ts`:
```ts
import { useEffect, useRef, useState } from 'react'

interface Handlers {
  onStep(id: string, last: boolean): void
  onDone(): void
  stepMs?: number
}

const LAST_HOLD_FACTOR = 1.6

export function usePrimer(ids: string[] | null, handlers: Handlers): { activeId: string | null } {
  const [activeId, setActiveId] = useState<string | null>(null)
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    if (!ids || ids.length === 0) {
      setActiveId(null)
      return
    }
    const stepMs = ref.current.stepMs ?? 1200
    let i = 0
    let timer: ReturnType<typeof setTimeout>
    const step = () => {
      if (i >= ids.length) {
        setActiveId(null)
        ref.current.onDone()
        return
      }
      const id = ids[i]
      const last = i === ids.length - 1
      setActiveId(id)
      ref.current.onStep(id, last)
      i++
      timer = setTimeout(step, last ? stepMs * LAST_HOLD_FACTOR : stepMs)
    }
    timer = setTimeout(step, 0)
    return () => clearTimeout(timer)
  }, [ids])

  return { activeId }
}
```

`src/ui/components/ChordTile.tsx`:
```tsx
import type { CSSProperties } from 'react'
import { registerAnchor } from '../../celebrations/anchors'
import type { Chord } from '../../core/types'

export type TileFlash = 'pop' | 'shake' | 'pulse' | 'highlight' | null

interface Props {
  chord: Chord
  showLetters: boolean
  napping: boolean
  flash: TileFlash
  disabled: boolean
  onTap: (id: string) => void
}

export function ChordTile({ chord, showLetters, napping, flash, disabled, onTap }: Props) {
  const cls = ['tile', napping ? 'napping' : '', flash ?? ''].filter(Boolean).join(' ')
  return (
    <button
      className={cls}
      data-testid={`tile-${chord.id}`}
      data-chord={chord.id}
      style={{ '--tile-color': chord.color } as CSSProperties}
      disabled={disabled || napping}
      aria-label={chord.character.name}
      onClick={() => onTap(chord.id)}
      ref={(el) => registerAnchor(chord.id, el)}
    >
      {chord.character.artUrl ? <img src={chord.character.artUrl} alt="" /> : <span>{chord.character.emoji}</span>}
      {showLetters && <span className="label">{chord.label}</span>}
    </button>
  )
}
```

`src/ui/components/TileGrid.tsx`:
```tsx
import type { ReactNode } from 'react'

export function TileGrid({ children, count }: { children: ReactNode; count: number }) {
  const cols = count <= 4 ? 2 : count <= 9 ? 3 : 4
  return (
    <div className="tile-grid" data-testid="tile-grid" data-cols={cols}>
      {children}
    </div>
  )
}
```

`src/ui/components/ProgressTrail.tsx`:
```tsx
import type { Answer } from '../../core/types'

export function ProgressTrail({ answers, target }: { answers: Answer[]; target: number }) {
  return (
    <div className="trail" aria-label={`${answers.length} of ${target}`}>
      {Array.from({ length: target }, (_, i) => {
        const a = answers[i]
        const cls = a ? (a.correct ? 'dot correct' : 'dot wrong') : 'dot'
        return <span key={i} className={cls} data-testid="trail-dot" />
      })}
    </div>
  )
}
```

`src/ui/components/StreakBadge.tsx`:
```tsx
export function StreakBadge({ streak, heat }: { streak: number; heat: number }) {
  if (streak < 3) return null
  const cls = ['streak-badge', heat >= 1 ? 'blazing' : heat >= 0.66 ? 'hot' : heat >= 0.33 ? 'warm' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls} data-testid="streak-badge" aria-label={`${streak} in a row`}>
      🔥 {streak}
    </div>
  )
}
```

- [ ] **Step 4: Implement `src/ui/screens/Session.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { randomDuration } from '../../audio/duration'
import { heatVars } from '../../celebrations/heat'
import { chordById } from '../../core/content/chords'
import { unlockedChordIds } from '../../core/content/curriculum'
import type { SessionState } from '../../core/engine/session'
import type { Profile } from '../../core/types'
import { activeProfile, useAppStore } from '../../state/store'
import { useAudio } from '../AudioContext'
import { ChordTile, type TileFlash } from '../components/ChordTile'
import { ProgressTrail } from '../components/ProgressTrail'
import { StreakBadge } from '../components/StreakBadge'
import { TileGrid } from '../components/TileGrid'
import { usePrimer } from '../hooks/usePrimer'

export const FEEDBACK_MS = 1000
const QUESTION_DELAY_MS = 150
const CONFIRM_SECONDS = 1.5
const PRIMER_SECONDS = 1.2

export function Session() {
  const session = useAppStore((s) => s.session)
  const profile = useAppStore(activeProfile)
  if (!session || !profile) return null
  return <SessionView session={session} profile={profile} />
}

function SessionView({ session, profile }: { session: SessionState; profile: Profile }) {
  const pendingPrimer = useAppStore((s) => s.pendingPrimer)
  const answer = useAppStore((s) => s.answer)
  const advance = useAppStore((s) => s.advance)
  const endSession = useAppStore((s) => s.endSession)
  const clearPrimer = useAppStore((s) => s.clearPrimer)
  const { player } = useAudio()
  const [lastChosen, setLastChosen] = useState<string | null>(null)

  const play = (chordId: string, seconds: number) => player.playChord(chordById(chordId).notes, seconds)

  const { activeId: primerId } = usePrimer(pendingPrimer, {
    onStep: (id, last) => {
      play(id, PRIMER_SECONDS)
      if (last) setTimeout(() => play(id, PRIMER_SECONDS), 800)
    },
    onDone: clearPrimer,
  })

  useEffect(() => {
    if (session.phase !== 'question' || !session.currentChordId || pendingPrimer) return
    const id = session.currentChordId
    const t = setTimeout(() => play(id, randomDuration(Math.random)), QUESTION_DELAY_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase, session.currentChordId, session.answers.length, pendingPrimer])

  useEffect(() => {
    if (session.phase !== 'feedback') return
    const last = session.answers[session.answers.length - 1]
    play(last.chordId, CONFIRM_SECONDS)
    const t = setTimeout(advance, last.correct ? FEEDBACK_MS : FEEDBACK_MS + 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase, session.answers.length])

  const { progression, settings } = profile
  const unlocked = unlockedChordIds(progression.unlocks)
  const last = session.answers[session.answers.length - 1]
  const inputLocked = session.phase !== 'question' || pendingPrimer !== null

  function flashFor(id: string): TileFlash {
    if (primerId === id) return 'highlight'
    if (session.phase !== 'feedback' || !last) return null
    if (last.correct) return id === last.chordId ? 'pop' : null
    if (id === lastChosen) return 'shake'
    if (id === last.chordId) return 'pulse'
    return null
  }

  function onTap(id: string) {
    if (inputLocked || id === progression.napping) return
    setLastChosen(id)
    answer(id)
  }

  return (
    <div className="screen session" data-screen="session" data-testid="screen-session" style={heatVars(progression.heat)}>
      <div className="row">
        <button className="icon-button" aria-label="Stop" onClick={endSession}>✕</button>
        <div className="grow" />
        <button
          className="icon-button"
          aria-label="Hear it again"
          disabled={inputLocked}
          onClick={() => session.currentChordId && play(session.currentChordId, randomDuration(Math.random))}
        >
          🔊
        </button>
      </div>
      <StreakBadge streak={progression.streak} heat={progression.heat} />
      <ProgressTrail answers={session.answers} target={session.target} />
      <TileGrid count={unlocked.length}>
        {unlocked.map((id) => (
          <ChordTile
            key={id}
            chord={chordById(id)}
            showLetters={settings.showLetters}
            napping={progression.napping === id}
            flash={flashFor(id)}
            disabled={inputLocked}
            onTap={onTap}
          />
        ))}
      </TileGrid>
    </div>
  )
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/ui
```
Expected: PASS. Notes if something fails:
- `toHaveStyle({ '--tile-color': ... })` requires jsdom to keep custom properties; if it does not, assert `tile('red').style.getPropertyValue('--tile-color')` instead.
- In the "correct tap" test the `played` array has two entries: the question (after 150 ms) and the confirmation replay.
- In the "hear again" test the disabled state is false during the question phase.

- [ ] **Step 6: Try it in the browser**

```bash
npm run dev
```
Play a session on a phone-sized viewport: tiles respond, chord plays, confirmation replays, wrong answers pulse the right tile, streak badge appears at 3, screen edges warm up with the streak. Stop returns to the (placeholder) summary.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add session screen with tiles, trail, streak badge and primer"
```

---

### Task 17: Get-ready ritual, level-up takeover, session summary

**Files:**
- Create: `src/ui/components/CharacterParade.tsx`, `src/ui/screens/LevelUp.tsx`; replace placeholders `src/ui/screens/GetReady.tsx`, `src/ui/screens/Summary.tsx`
- Modify: `src/ui/App.tsx` (render `LevelUp` overlay when the session phase is `levelUp`)
- Test: `src/ui/screens/GetReady.test.tsx`, `src/ui/screens/LevelUp.test.tsx`, `src/ui/screens/Summary.test.tsx`

**Interfaces:**
- Produces: `CharacterParade({ chordIds })`, `GetReady()`, `LevelUp()`, `Summary()`, constants `MIN_RITUAL_MS = 1500`, `LISTEN_MS = 800`, `SLOW_LOAD_MS = 6000`.
- `GetReady` resumes an existing unfinished session (`goTo('session')`) instead of starting a new one when `session.phase !== 'summary'`.
- `LevelUp` is rendered by `App` above `Session` whenever `session.phase === 'levelUp'`.

- [ ] **Step 1: Write failing tests**

`src/ui/screens/GetReady.test.tsx`:
```tsx
import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNullPlayer } from '../../audio/player'
import { useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { GetReady, LISTEN_MS, MIN_RITUAL_MS } from './GetReady'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
  useAppStore.setState({ screen: 'getReady' })
})
afterEach(() => vi.useRealTimers())

const flush = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('GetReady', () => {
  it('unlocks audio, loads the instrument, parades, cues Listen, then starts the session', async () => {
    const player = createNullPlayer()
    renderApp(<GetReady />, { player })
    expect(screen.getByTestId('screen-getReady')).toBeInTheDocument()
    expect(screen.getByText('🦁')).toBeInTheDocument()
    await flush(0)
    expect(player.unlocked).toBe(true)
    expect(player.loaded).toEqual(['piano'])
    expect(useAppStore.getState().session).toBeNull()
    await flush(MIN_RITUAL_MS)
    expect(screen.getByText(/listen/i)).toBeInTheDocument()
    await flush(LISTEN_MS)
    expect(useAppStore.getState().session?.phase).toBe('question')
    expect(useAppStore.getState().screen).toBe('session')
  })

  it('resumes an unfinished session instead of starting over', async () => {
    useAppStore.getState().startSession()
    const before = useAppStore.getState().session
    useAppStore.setState({ screen: 'getReady' })
    renderApp(<GetReady />, { player: createNullPlayer() })
    await flush(MIN_RITUAL_MS + LISTEN_MS + 10)
    expect(useAppStore.getState().session).toBe(before)
    expect(useAppStore.getState().screen).toBe('session')
  })

  it('falls back to piano when the chosen instrument fails, and offers retry when everything fails', async () => {
    useAppStore.getState().updateSettings({ instrumentId: 'organ' })
    const player = createNullPlayer()
    player.failLoads = 3
    const first = renderApp(<GetReady />, { player })
    await flush(MIN_RITUAL_MS + LISTEN_MS + 3000)
    expect(player.loaded).toEqual(['organ', 'organ', 'organ', 'piano'])
    expect(useAppStore.getState().screen).toBe('session')
    first.unmount()

    resetStore()
    useAppStore.getState().createProfile('Bo', '🐶')
    useAppStore.setState({ screen: 'getReady' })
    const dead = createNullPlayer()
    dead.failLoads = 99
    renderApp(<GetReady />, { player: dead })
    await flush(10000)
    expect(screen.getByText(/can't load the sounds/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
```

`src/ui/screens/LevelUp.test.tsx`:
```tsx
import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNullPlayer } from '../../audio/player'
import { createNullSfx } from '../../audio/sfx'
import { useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { LevelUp } from './LevelUp'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
  useAppStore.getState().updateSettings({ pacingParams: { streakTarget: 3, eguchiWindow: 40, eguchiDays: 14, eguchiSessions: 10 } })
  useAppStore.getState().startSession()
  let guard = 0
  while (useAppStore.getState().session?.phase !== 'levelUp' && guard++ < 30) {
    useAppStore.getState().answer(useAppStore.getState().session!.currentChordId!)
    useAppStore.getState().advance()
  }
})
afterEach(() => vi.useRealTimers())

describe('LevelUp', () => {
  it('reveals the new character, plays its chord three times, and continues with a primer', () => {
    expect(useAppStore.getState().session?.phase).toBe('levelUp')
    const player = createNullPlayer()
    const sfx = createNullSfx()
    renderApp(<LevelUp />, { player, sfx })
    expect(screen.getByText(/meet whale/i)).toBeInTheDocument()
    expect(sfx.calls).toContain('fanfare')
    act(() => vi.advanceTimersByTime(3500))
    expect(player.played).toHaveLength(3)
    fireEvent.click(screen.getByText('🐳'))
    expect(player.played).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(useAppStore.getState().session?.phase).toBe('question')
    expect(useAppStore.getState().pendingPrimer).toEqual(['red', 'yellow', 'blue'])
  })
})
```

`src/ui/screens/Summary.test.tsx`:
```tsx
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { Summary } from './Summary'

beforeEach(() => {
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
  useAppStore.getState().updateSettings({ sessionTarget: 10, pacing: 'manual' })
  useAppStore.getState().startSession()
  for (let i = 0; i < 10; i++) {
    const s = useAppStore.getState().session!
    useAppStore.getState().answer(i === 0 ? (s.currentChordId === 'red' ? 'yellow' : 'red') : s.currentChordId!)
    useAppStore.getState().advance()
  }
})

describe('Summary', () => {
  it('shows stars, score and cheering friends, and navigates', () => {
    expect(useAppStore.getState().screen).toBe('summary')
    renderApp(<Summary />)
    expect(screen.getByTestId('stars').textContent).toBe('⭐⭐')
    expect(screen.getByText(/9 of 10/)).toBeInTheDocument()
    expect(screen.getByText('🦁')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play again/i }))
    expect(useAppStore.getState().screen).toBe('getReady')
    useAppStore.setState({ screen: 'summary' })
    fireEvent.click(screen.getByRole('button', { name: /home/i }))
    expect(useAppStore.getState().screen).toBe('home')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/ui/screens/GetReady.test.tsx src/ui/screens/LevelUp.test.tsx src/ui/screens/Summary.test.tsx
```

- [ ] **Step 3: Implement**

`src/ui/components/CharacterParade.tsx`:
```tsx
import { chordById } from '../../core/content/chords'

export function CharacterParade({ chordIds }: { chordIds: string[] }) {
  return (
    <div className="parade" aria-hidden="true">
      {chordIds.map((id, i) => (
        <span key={id} style={{ animationDelay: `${i * 120}ms` }}>
          {chordById(id).character.emoji}
        </span>
      ))}
    </div>
  )
}
```

`src/ui/screens/GetReady.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { loadWithFallback } from '../../audio/loading'
import { chordById } from '../../core/content/chords'
import { awakeChordIds, unlockedChordIds } from '../../core/content/curriculum'
import { DEFAULT_INSTRUMENT_ID, instrumentById } from '../../core/content/instruments'
import { activeProfile, useAppStore } from '../../state/store'
import { useAudio } from '../AudioContext'
import { CharacterParade } from '../components/CharacterParade'

export const MIN_RITUAL_MS = 1500
export const LISTEN_MS = 800
export const SLOW_LOAD_MS = 6000

type Stage = 'loading' | 'listen' | 'error'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function GetReady() {
  const profile = useAppStore(activeProfile)
  const session = useAppStore((s) => s.session)
  const startSession = useAppStore((s) => s.startSession)
  const goTo = useAppStore((s) => s.goTo)
  const { player, sfx } = useAudio()
  const [stage, setStage] = useState<Stage>('loading')
  const [slow, setSlow] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    setStage('loading')
    setSlow(false)
    const slowTimer = setTimeout(() => setSlow(true), SLOW_LOAD_MS)
    const resuming = session !== null && session.phase !== 'summary'
    const notes = awakeChordIds(profile.progression).flatMap((id) => [...chordById(id).notes])
    const instrument = instrumentById(profile.settings.instrumentId)

    ;(async () => {
      const minimum = sleep(MIN_RITUAL_MS)
      await player.unlock()
      await loadWithFallback(player, instrument, notes, instrumentById(DEFAULT_INSTRUMENT_ID))
      await minimum
      if (cancelled) return
      clearTimeout(slowTimer)
      setStage('listen')
      if (profile.settings.celebrationSound) sfx.whoosh()
      await sleep(LISTEN_MS)
      if (cancelled) return
      if (resuming) goTo('session')
      else startSession()
    })().catch(() => {
      if (cancelled) return
      clearTimeout(slowTimer)
      setStage('error')
    })

    return () => {
      cancelled = true
      clearTimeout(slowTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, profile?.id])

  if (!profile) return null
  return (
    <div className="screen center" data-screen="getReady" data-testid="screen-getReady" style={{ justifyContent: 'center' }}>
      {stage === 'error' ? (
        <>
          <p style={{ fontSize: '3rem' }}>🔇</p>
          <p>We can't load the sounds right now. Check the connection and try again.</p>
          <button className="big-button" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
          <button className="big-button secondary" onClick={() => goTo('home')}>Back</button>
        </>
      ) : stage === 'listen' ? (
        <p className="listen">👂 Listen!</p>
      ) : (
        <>
          <CharacterParade chordIds={unlockedChordIds(profile.progression.unlocks)} />
          <p className="muted">{slow ? 'Getting the sounds ready…' : 'Here they come!'}</p>
        </>
      )}
    </div>
  )
}
```

`src/ui/screens/LevelUp.tsx`:
```tsx
import { useEffect } from 'react'
import { chordById } from '../../core/content/chords'
import { newestUnlockedId } from '../../core/content/curriculum'
import { activeProfile, useAppStore } from '../../state/store'
import { useAudio } from '../AudioContext'

const PLAYS = [0, 1500, 3000]
const REVEAL_SECONDS = 1.4

export function LevelUp() {
  const profile = useAppStore(activeProfile)
  const continueAfterLevelUp = useAppStore((s) => s.continueAfterLevelUp)
  const { player, sfx } = useAudio()
  const chord = profile ? chordById(newestUnlockedId(profile.progression.unlocks)) : null

  useEffect(() => {
    if (!chord || !profile) return
    if (profile.settings.celebrationSound) sfx.fanfare()
    const timers = PLAYS.map((ms) => setTimeout(() => player.playChord([...chord.notes], REVEAL_SECONDS), ms))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chord?.id])

  if (!chord) return null
  return (
    <div className="overlay" data-testid="level-up" role="dialog" aria-label="New friend">
      <p style={{ fontSize: '1.4rem', margin: 0 }}>New friend!</p>
      <h1 style={{ margin: 0, fontSize: '2.4rem' }}>Meet {chord.character.name}!</h1>
      <div
        className="reveal"
        style={{ textShadow: `0 0 40px ${chord.color}` }}
        onClick={() => player.playChord([...chord.notes], REVEAL_SECONDS)}
      >
        {chord.character.emoji}
      </div>
      <button className="big-button" onClick={continueAfterLevelUp}>Continue</button>
    </div>
  )
}
```

`src/ui/screens/Summary.tsx`:
```tsx
import { chordById } from '../../core/content/chords'
import { awakeChordIds, newestUnlockedId } from '../../core/content/curriculum'
import { activeProfile, useAppStore } from '../../state/store'

const LINES = ['Great listening!', 'Your ears are growing!', 'Wonderful!', 'You did it!']

export function Summary() {
  const profile = useAppStore(activeProfile)
  const session = useAppStore((s) => s.session)
  const goTo = useAppStore((s) => s.goTo)
  if (!profile || !session?.summary) return null
  const { summary } = session
  const featured = summary.leveledUp ? chordById(newestUnlockedId(profile.progression.unlocks)) : null
  const line = LINES[summary.count % LINES.length]

  return (
    <div className="screen center" data-screen="summary" data-testid="screen-summary" style={{ justifyContent: 'center' }}>
      <p className="stars" data-testid="stars" style={{ fontSize: '3rem', margin: 0 }}>
        {'⭐'.repeat(summary.stars)}
      </p>
      <h1 className="screen-title">{line}</h1>
      <p className="muted">{summary.correct} of {summary.count}</p>
      {featured && (
        <p>
          <span className="badge">New friend: {featured.character.emoji} {featured.character.name}</span>
        </p>
      )}
      <div className="character-strip" aria-label="Your friends cheer">
        {awakeChordIds(profile.progression).map((id) => (
          <span key={id} className="parade" style={{ fontSize: '2.4rem' }}>
            <span>{chordById(id).character.emoji}</span>
          </span>
        ))}
      </div>
      <div className="grow" />
      <button className="big-button" onClick={() => goTo('getReady')}>▶ Play again</button>
      <button className="big-button secondary" onClick={() => goTo('home')}>🏠 Home</button>
    </div>
  )
}
```

Update `src/ui/App.tsx`: add `import { LevelUp } from './screens/LevelUp'`, read `const phase = useAppStore((s) => s.session?.phase)`, and render `{screen === 'session' && phase === 'levelUp' && <LevelUp />}` right after the `Session` line.

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/ui
```
Expected: PASS. If the GetReady fallback test's timing is off, the `loadWithFallback` default sleep uses real `setTimeout`, which fake timers control; `advanceTimersByTimeAsync` flushes the awaited promises between timers.

- [ ] **Step 5: Try the full loop in the browser**

```bash
npm run dev
```
Play → parade → Listen! → session → set streak target to 3 in parent settings to see the level-up overlay quickly → Continue → primer runs → finish → summary with stars → Play again.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add get-ready ritual, level-up takeover and session summary"
```

---

### Task 18: Celebration layer, haptics, reduced motion

**Files:**
- Create: `src/celebrations/haptics.ts`, `src/ui/hooks/useReducedMotion.ts`; replace placeholder `src/celebrations/CelebrationLayer.tsx`
- Test: `src/celebrations/haptics.test.ts`, `src/celebrations/CelebrationLayer.test.tsx`

**Interfaces:**
- Produces: `vibrate(pattern: number[], enabled: boolean): void`, `useReducedMotion(): boolean`, `CelebrationLayer({ system?: ParticleSystem })`.
- Event → effect mapping (spec §7): `answered` correct → burst at the tile + `pop`; `answered` wrong → steam + `steam`; `streakMilestone` → fountain + `whoosh`; `chordWoken` → double burst + `whoosh`; `levelUp` → six fireworks over 1.5 s (fanfare is played by the LevelUp screen, not here); `sessionComplete` with answers → confetti + three fireworks + `cymbal`. Sounds only when `settings.celebrationSound`; vibration only when `settings.haptics`. Flames run each frame on the session screen while intensity is not `calm`.

- [ ] **Step 1: Write failing tests**

`src/celebrations/haptics.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { vibrate } from './haptics'

afterEach(() => vi.unstubAllGlobals())

describe('vibrate', () => {
  it('calls navigator.vibrate when enabled and supported', () => {
    const fn = vi.fn()
    vi.stubGlobal('navigator', { vibrate: fn })
    vibrate([20], true)
    expect(fn).toHaveBeenCalledWith([20])
    vibrate([20], false)
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('is a no-op without support', () => {
    vi.stubGlobal('navigator', {})
    expect(() => vibrate([20], true)).not.toThrow()
  })
})
```

`src/celebrations/CelebrationLayer.test.tsx`:
```tsx
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNullSfx } from '../audio/sfx'
import { mulberry32 } from '../core/engine/rng'
import { emitEngineEvents } from '../state/eventBus'
import { useAppStore } from '../state/store'
import { renderApp, resetStore } from '../ui/testing'
import { CelebrationLayer } from './CelebrationLayer'
import { ParticleSystem } from './particles'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const summary = { startedAt: 0, endedAt: 1, count: 20, correct: 20, levelAtStart: 1, stars: 3, leveledUp: false, countsForPacing: true }

describe('CelebrationLayer', () => {
  it('bursts and pops on a correct answer, steams on a miss', () => {
    const system = new ParticleSystem(5000, mulberry32(1))
    const sfx = createNullSfx()
    renderApp(<CelebrationLayer system={system} />, { sfx })
    act(() => emitEngineEvents([{ type: 'answered', chordId: 'red', chosenId: 'red', correct: true, streak: 1, heat: 0.1 }]))
    expect(system.count).toBeGreaterThan(0)
    expect(sfx.calls).toEqual(['pop'])
    const before = system.count
    act(() => emitEngineEvents([{ type: 'answered', chordId: 'red', chosenId: 'yellow', correct: false, streak: 0, heat: 0 }]))
    expect(system.count).toBeGreaterThan(before)
    expect(sfx.calls).toEqual(['pop', 'steam'])
  })

  it('launches a staggered barrage on level up and confetti on session complete', () => {
    const system = new ParticleSystem(5000, mulberry32(1))
    const sfx = createNullSfx()
    renderApp(<CelebrationLayer system={system} />, { sfx })
    act(() => emitEngineEvents([{ type: 'levelUp', chordId: 'blue', level: 2 }]))
    expect(system.count).toBe(1)
    act(() => vi.advanceTimersByTime(1600))
    expect(system.count).toBe(6)
    act(() => emitEngineEvents([{ type: 'sessionComplete', summary }]))
    expect(system.count).toBeGreaterThan(100)
    expect(sfx.calls).toEqual(['cymbal'])
  })

  it('respects intensity and sound settings', () => {
    useAppStore.getState().updateSettings({ intensity: 'calm', celebrationSound: false })
    const system = new ParticleSystem(5000, mulberry32(1))
    const sfx = createNullSfx()
    renderApp(<CelebrationLayer system={system} />, { sfx })
    act(() => emitEngineEvents([{ type: 'answered', chordId: 'red', chosenId: 'red', correct: true, streak: 1, heat: 0.1 }]))
    expect(system.count).toBeGreaterThan(0)
    expect(system.count).toBeLessThan(20)
    expect(sfx.calls).toEqual([])
  })

  it('does nothing for an empty session', () => {
    const system = new ParticleSystem(5000, mulberry32(1))
    renderApp(<CelebrationLayer system={system} />)
    act(() => emitEngineEvents([{ type: 'sessionComplete', summary: { ...summary, count: 0, correct: 0, stars: 0 } }]))
    expect(system.count).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/celebrations/haptics.test.ts src/celebrations/CelebrationLayer.test.tsx
```

- [ ] **Step 3: Implement**

`src/celebrations/haptics.ts`:
```ts
export function vibrate(pattern: number[], enabled: boolean): void {
  if (!enabled) return
  const nav = navigator as Navigator & { vibrate?: (p: number[]) => boolean }
  if (typeof nav.vibrate === 'function') nav.vibrate(pattern)
}
```

`src/ui/hooks/useReducedMotion.ts`:
```ts
import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window.matchMedia === 'function' ? window.matchMedia(QUERY).matches : false,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(QUERY)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}
```

`src/celebrations/CelebrationLayer.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { chordById } from '../core/content/chords'
import type { EngineEvent } from '../core/engine/events'
import { onEngineEvent } from '../state/eventBus'
import { activeProfile, useAppStore } from '../state/store'
import { useAudio } from '../ui/AudioContext'
import { useReducedMotion } from '../ui/hooks/useReducedMotion'
import { anchorCenter } from './anchors'
import { burst, confetti, firework, flames, fountain, steam } from './emitters'
import { vibrate } from './haptics'
import { ParticleSystem } from './particles'
import { effectiveIntensity, intensityScale, moodPalette } from './presets'

const CONFETTI_COLORS = ['#ffd54f', '#4fc3f7', '#ff7043', '#66bb6a', '#ba68c8']
const MILESTONE_COLORS = ['#ffd54f', '#ffffff', '#ff7043']
const BARRAGE = 6
const BARRAGE_GAP_MS = 250
const SLOW_FRAME_S = 0.032
const SLOW_FRAMES_BEFORE_CAP = 30
const REDUCED_MAX = 600

export function CelebrationLayer({ system }: { system?: ParticleSystem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sysRef = useRef(system ?? new ParticleSystem())
  const { sfx } = useAudio()
  const reduced = useReducedMotion()
  const settings = useAppStore((s) => activeProfile(s)?.settings)
  const heat = useAppStore((s) => activeProfile(s)?.progression.heat ?? 0)
  const screen = useAppStore((s) => s.screen)
  const live = useRef({ settings, reduced, heat, screen })
  live.current = { settings, reduced, heat, screen }

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const off = onEngineEvent((e: EngineEvent) => {
      const { settings, reduced } = live.current
      const scale = intensityScale(effectiveIntensity(settings?.intensity ?? 'full', reduced))
      const sound = settings?.celebrationSound ?? true
      const haptics = settings?.haptics ?? true
      const sys = sysRef.current
      const w = window.innerWidth
      const h = window.innerHeight
      const at = (id: string) => anchorCenter(id) ?? { x: w / 2, y: h / 2 }
      const palette = (id: string) => {
        const c = chordById(id)
        return moodPalette(c.character.mood, c.color)
      }

      switch (e.type) {
        case 'answered': {
          if (e.correct) {
            const p = at(e.chordId)
            burst(sys, p.x, p.y, palette(e.chordId), scale)
            if (sound) sfx.pop()
            vibrate([20], haptics)
          } else {
            steam(sys, w, h, scale)
            if (sound) sfx.steam()
          }
          break
        }
        case 'streakMilestone':
          fountain(sys, w / 2, h * 0.8, MILESTONE_COLORS, scale)
          if (sound) sfx.whoosh()
          vibrate([30, 50, 30], haptics)
          break
        case 'chordWoken': {
          const p = at(e.chordId)
          burst(sys, p.x, p.y, palette(e.chordId), scale * 2)
          if (sound) sfx.whoosh()
          break
        }
        case 'levelUp':
          for (let i = 0; i < BARRAGE; i++) {
            timers.push(
              setTimeout(() => {
                firework(sys, w * (0.2 + 0.6 * Math.random()), h, h * (0.15 + 0.35 * Math.random()), palette(e.chordId), scale)
              }, i * BARRAGE_GAP_MS),
            )
          }
          vibrate([50, 80, 50, 80, 120], haptics)
          break
        case 'sessionComplete':
          if (e.summary.count === 0) break
          confetti(sys, w, CONFETTI_COLORS, scale)
          for (let i = 0; i < 3; i++) {
            timers.push(setTimeout(() => firework(sys, w * (0.25 + 0.25 * i), h, h * 0.3, CONFETTI_COLORS, scale), i * 400))
          }
          if (sound) sfx.cymbal()
          vibrate([40, 60, 40], haptics)
          break
        default:
          break
      }
    })
    return () => {
      off()
      timers.forEach(clearTimeout)
    }
  }, [sfx])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const sys = sysRef.current
    let raf = 0
    let last = performance.now()
    let slowFrames = 0

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      const { heat, screen, settings, reduced } = live.current
      const intensity = effectiveIntensity(settings?.intensity ?? 'full', reduced)
      if (screen === 'session' && intensity !== 'calm') flames(sys, window.innerWidth, window.innerHeight, heat, dt)
      sys.tick(dt)
      if (ctx) {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
        sys.draw(ctx)
      }
      if (dt > SLOW_FRAME_S) {
        if (++slowFrames >= SLOW_FRAMES_BEFORE_CAP) sys.setMax(REDUCED_MAX)
      } else {
        slowFrames = 0
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="celebration-canvas" aria-hidden="true" />
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/celebrations src/ui
```
Expected: PASS. jsdom's `canvas.getContext` returns `null` (or logs "not implemented"); the layer guards on `ctx` so drawing is skipped in tests.

- [ ] **Step 5: Browser check**

```bash
npm run dev
```
Correct answers burst from the tile in the chord's colours; misses puff steam from the edges; at streak 8+ flames lick up from the bottom; level-up fires a barrage behind the overlay; summary rains confetti. Toggle intensity to calm in parent settings and confirm flames stop.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add celebration canvas layer with haptics and reduced-motion support"
```

---

### Task 19: PWA, icons, offline sample caching

**Files:**
- Create: `public/icons/icon.svg`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `scripts/make-icons.ts`
- Modify: `vite.config.ts`, `index.html`, `src/main.tsx`, `tsconfig.app.json`, `package.json`

**Interfaces:**
- Produces: installable PWA with manifest, precached app shell, and `CacheFirst` runtime caching of `/samples/**`. `npm run icons` regenerates PNG icons from the SVG.

- [ ] **Step 1: Icon SVG**

`public/icons/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#ff7043"/>
  <circle cx="176" cy="300" r="70" fill="#e53935" stroke="#fff" stroke-width="14"/>
  <circle cx="256" cy="212" r="70" fill="#fdd835" stroke="#fff" stroke-width="14"/>
  <circle cx="336" cy="300" r="70" fill="#1e88e5" stroke="#fff" stroke-width="14"/>
</svg>
```

- [ ] **Step 2: Icon script**

```bash
npm install -D sharp
npm pkg set scripts.icons="node scripts/make-icons.ts"
```

`scripts/make-icons.ts`:
```ts
import sharp from 'sharp'

const src = new URL('../public/icons/icon.svg', import.meta.url).pathname
for (const size of [192, 512]) {
  const out = new URL(`../public/icons/icon-${size}.png`, import.meta.url).pathname
  await sharp(src).resize(size, size).png().toFile(out)
  console.log(out)
}
```

```bash
npm run icons
ls -la public/icons
```
Expected: two PNGs. These are committed (small, regenerated only when the SVG changes).

- [ ] **Step 3: Vite PWA config**

`vite.config.ts`:
```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Ear Trainer',
        short_name: 'Ear Trainer',
        description: 'Chord ear training for young children',
        theme_color: '#ff7043',
        background_color: '#fffaf3',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: /\/samples\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'samples',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
```

- [ ] **Step 4: index.html and service worker registration**

Replace `index.html` `<head>` contents:
```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
<meta name="theme-color" content="#ff7043" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
<title>Ear Trainer</title>
```

In `src/main.tsx` add at the top:
```ts
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })
```

In `tsconfig.app.json` set `"types": ["vite/client", "vite-plugin-pwa/client"]`.

- [ ] **Step 5: Build and inspect**

```bash
npm run typecheck && npm run build
ls dist dist/icons
grep -c "samples" dist/sw.js
cat dist/manifest.webmanifest
```
Expected: `dist/sw.js`, `dist/workbox-*.js`, `dist/manifest.webmanifest`, icons copied; grep count ≥ 1.

- [ ] **Step 6: Manual PWA check**

```bash
npm run preview
```
Open in Chrome on a phone or with device emulation: the install prompt is available, the app works after toggling offline in DevTools once a session has loaded samples.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Configure PWA manifest, icons and offline sample caching"
```

---

### Task 20: CI, Amplify config, Playwright smoke test, docs

**Files:**
- Create: `.github/workflows/ci.yml`, `amplify.yml`, `playwright.config.ts`, `e2e/session.spec.ts`, `e2e/global.d.ts`, `e2e/tsconfig.json`
- Modify: `README.md`

**Interfaces:**
- The smoke test drives a full session through the real UI with sample requests intercepted and answered with a generated silent WAV, reading the current chord from `window.__earTrainer`.

- [ ] **Step 1: Playwright config**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
```

`e2e/global.d.ts`:
```ts
interface EarTrainerState {
  screen: string
  session: { phase: string; currentChordId: string | null } | null
}
interface Window {
  __earTrainer: { getState(): EarTrainerState }
}
```

`e2e/tsconfig.json`:
```json
{
  "compilerOptions": { "target": "es2022", "module": "esnext", "moduleResolution": "bundler", "strict": true, "types": ["node"] },
  "include": ["./**/*.ts"]
}
```

- [ ] **Step 2: Smoke test**

`e2e/session.spec.ts`:
```ts
import { expect, test } from '@playwright/test'

function silentWav(seconds = 0.3, rate = 22050): Buffer {
  const data = Buffer.alloc(Math.floor(seconds * rate) * 2)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

test('a child can complete a session and level up', async ({ page }) => {
  await page.route('**/samples/**', (route) =>
    route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() }),
  )
  await page.goto('/')
  await page.getByLabel('Name').fill('Ada')
  await page.getByRole('button', { name: "Let's go!" }).click()
  await page.getByRole('button', { name: /play/i }).click()
  await expect(page.getByTestId('screen-session')).toBeVisible({ timeout: 20_000 })

  let leveledUp = false
  for (let i = 0; i < 60; i++) {
    const s = await page.evaluate(() => {
      const st = window.__earTrainer.getState()
      return { screen: st.screen, phase: st.session?.phase, current: st.session?.currentChordId ?? null }
    })
    if (s.screen === 'summary') break
    if (s.phase === 'levelUp') {
      leveledUp = true
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.waitForTimeout(5000) // primer for three chords
      continue
    }
    if (s.phase !== 'question' || !s.current) {
      await page.waitForTimeout(200)
      continue
    }
    await page.getByTestId(`tile-${s.current}`).click()
    await page.waitForTimeout(1200)
  }

  await expect(page.getByTestId('screen-summary')).toBeVisible()
  await expect(page.getByTestId('stars')).toHaveText('⭐⭐⭐')
  expect(leveledUp).toBe(true)
})
```

- [ ] **Step 3: Run it locally**

```bash
npx playwright install chromium
npm run e2e
```
Expected: 1 passed. If the level-up never triggers within 20 answers, the streak of 10 needs both chords to appear in the streak; the weighted selection makes that near-certain, so a failure here points at a real regression in the engine or UI wiring.

- [ ] **Step 4: CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run format:check
      - run: npm test
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
        env:
          CI: true
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report
```

- [ ] **Step 5: Amplify config**

`amplify.yml`:
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - nvm install 22 && nvm use 22
        - npm ci
        - npm run samples
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - public/samples/**/*
```

- [ ] **Step 6: README**

Append to `README.md`:
```markdown
## Layout

- `src/core` — framework-free content and session engine (pure functions, typed events)
- `src/state` — Zustand store, persistence, migrations, export/import
- `src/audio` — Tone.js sampler player, sample loading with fallback, unpitched SFX
- `src/celebrations` — canvas particle layer, heat colours, haptics
- `src/ui` — React screens and components
- `scripts/fetch-samples.ts` — downloads CC-BY samples listed in `src/core/content/instruments.ts`

## Amplify

Connect the repo; `amplify.yml` is picked up automatically. Add a rewrite
rule `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webmanifest|mp3)$)([^.]+$)/>` → `/index.html` (200)
if you later add client-side routes; the app currently has none.

## Licences

Code: MIT (see `LICENSE`). Audio samples: see `THIRD_PARTY_NOTICES.md`.
```

- [ ] **Step 7: Full verification**

```bash
npm run format && npm run typecheck && npm run lint && npm run format:check && npm test && npm run build && npm run e2e
```
Expected: all green.

- [ ] **Step 8: Commit and push**

```bash
git add -A
git commit -m "Add CI workflow, Amplify config, Playwright smoke test and docs"
git push origin main
```

---

## Spec coverage map

| Spec section | Tasks |
|---|---|
| §3 Architecture, stack, hosting | 1, 11, 19, 20 |
| §4 Content model (chords, characters, level, instruments) | 2, 3 |
| §5 Session flow, selection, recovery ladder, get-ready ritual | 5, 6, 8, 9, 16, 17 |
| §6 Progression, pacing, level-up moment, primer, champion | 7, 9, 11, 16, 17 |
| §7 Rewards, ambient heat, celebration layer, summary, sound, intensity | 4, 13, 16, 17, 18 |
| §8 Audio | 3, 12, 17, 19 |
| §9 Persistence, profiles, parent gate, export/import | 10, 11, 14, 15 |
| §10 Screens | 14, 15, 16, 17 |
| §11 Error handling | 10, 11, 12, 17, 18 |
| §12 Testing, CI | every task; 20 |
