import * as Tone from 'tone'
import { midiToNote, noteToMidi, transpose } from './notes'

const MIN_GAP_S = 0.005
const OCTAVE = 12

export interface Sfx {
  whoosh(): void
  pop(): void
  /** "ding-ding" built from the tapped chord, an octave up. */
  correct(chordNotes: readonly string[]): void
  thud(): void
  cymbal(): void
  steam(): void
  wrong(): void
  /** Three chimes: the tapped chord's notes an octave up, in order. */
  milestone(chordNotes: readonly string[]): void
  fanfare(): void
  /** Rising arpeggio in the given key (a pitch class such as 'C', 'F', 'Bb'). */
  jingleLevelUp(key: string): void
  jingleSessionEnd(): void
}

export function createNullSfx(): Sfx & { calls: string[] } {
  const calls: string[] = []
  const rec = (name: string) => () => void calls.push(name)
  return {
    calls,
    whoosh: rec('whoosh'),
    pop: rec('pop'),
    correct: rec('correct'),
    thud: rec('thud'),
    cymbal: rec('cymbal'),
    steam: rec('steam'),
    wrong: rec('wrong'),
    milestone: rec('milestone'),
    fanfare: rec('fanfare'),
    jingleLevelUp: rec('jingleLevelUp'),
    jingleSessionEnd: rec('jingleSessionEnd'),
  }
}

// Jingles live an octave above the chord vocabulary (highest chord note E5).
// The level-up jingle is a major arpeggio in the key of the chord that earned it:
// semitone offsets from the root, with note times in seconds.
const LEVEL_UP_JINGLE: [number, number][] = [
  [0, 0],
  [4, 0.12],
  [7, 0.24],
  [12, 0.36],
  [7, 0.6],
  [12, 0.72],
]
const KEY_OFFSET: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
}

/** Jingle root for a key: roots C–E sit in octave 6, F–B drop to octave 5 so the top note stays below C8. */
function jingleRoot(key: string): string {
  const offset = KEY_OFFSET[key] ?? 0
  const octave = offset >= 5 ? 5 : 6
  return midiToNote((octave + 1) * 12 + offset)
}
const SESSION_END_JINGLE: [string, number][] = [
  ['G6', 0],
  ['E6', 0.15],
  ['G6', 0.3],
  ['C7', 0.45],
]

export function createToneSfx(): Sfx {
  let noise: Tone.NoiseSynth | null = null
  let metal: Tone.MetalSynth | null = null
  let drum: Tone.MembraneSynth | null = null
  let blip: Tone.Synth | null = null
  let bell: Tone.Synth | null = null
  let filter: Tone.Filter | null = null
  const lastStart: Record<string, number> = {}

  function ensure() {
    if (noise) return
    filter = new Tone.Filter(1200, 'bandpass').toDestination()
    noise = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0 },
    }).connect(filter)
    metal = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.6, release: 0.2 },
      harmonicity: 5.1,
      resonance: 4000,
      octaves: 1.5,
    }).toDestination()
    metal.volume.value = -14
    drum = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
    }).toDestination()
    drum.volume.value = -6
    blip = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.15 },
    }).toDestination()
    blip.volume.value = -10
    bell = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.25, sustain: 0.1, release: 0.4 },
    }).toDestination()
    bell.volume.value = -8
  }

  function playJingle(notes: [string, number][]) {
    for (const [note, offset] of notes) bell!.triggerAttackRelease(note, 0.2, at('bell', offset))
  }

  // Tone sources throw if started at or before their previous start time, so
  // each synth's start times are kept strictly increasing.
  function at(key: string, offset = 0): number {
    const t = Math.max(Tone.now() + offset, (lastStart[key] ?? -Infinity) + MIN_GAP_S)
    lastStart[key] = t
    return t
  }

  // A celebration sound must never take the app down with it.
  function safely(fn: () => void) {
    try {
      ensure()
      fn()
    } catch (err) {
      console.warn('sfx skipped', err)
    }
  }

  return {
    whoosh() {
      safely(() => {
        filter!.frequency.rampTo(3000, 0.25)
        noise!.envelope.decay = 0.35
        noise!.triggerAttackRelease(0.3, at('noise'))
      })
    },
    pop() {
      safely(() => {
        filter!.frequency.value = 2500
        noise!.envelope.decay = 0.08
        noise!.triggerAttackRelease(0.05, at('noise'))
      })
    },
    correct(chordNotes) {
      // Lowest and highest chord notes an octave up, so each chord has its own ding-ding.
      safely(() => {
        const up = transpose(chordNotes, OCTAVE)
        bell!.triggerAttackRelease(up[0], 0.15, at('bell'))
        bell!.triggerAttackRelease(up[up.length - 1], 0.25, at('bell', 0.12))
      })
    },
    thud() {
      safely(() => drum!.triggerAttackRelease('C1', 0.2, at('drum')))
    },
    cymbal() {
      safely(() => metal!.triggerAttackRelease('C3', 0.5, at('metal')))
    },
    steam() {
      safely(() => {
        filter!.frequency.value = 800
        noise!.envelope.decay = 0.9
        noise!.triggerAttackRelease(0.8, at('noise'))
      })
    },
    wrong() {
      // A descending two-tone "bee-oop". Pitched, deliberately: it sits an octave
      // below the chord vocabulary (lowest chord note A3) so it never reads as a chord.
      safely(() => {
        blip!.triggerAttackRelease('E3', 0.18, at('blip'))
        blip!.triggerAttackRelease('A2', 0.35, at('blip', 0.2))
      })
    },
    milestone(chordNotes) {
      safely(() => {
        transpose(chordNotes, OCTAVE).forEach((note, i) =>
          bell!.triggerAttackRelease(note, 0.3, at('bell', i * 0.13)),
        )
      })
    },
    jingleLevelUp(key) {
      safely(() => {
        const root = noteToMidi(jingleRoot(key))
        for (const [semitones, offset] of LEVEL_UP_JINGLE) {
          bell!.triggerAttackRelease(midiToNote(root + semitones), 0.2, at('bell', offset))
        }
      })
    },
    jingleSessionEnd() {
      safely(() => playJingle(SESSION_END_JINGLE))
    },
    fanfare() {
      safely(() => {
        drum!.triggerAttackRelease('C1', 0.2, at('drum'))
        drum!.triggerAttackRelease('C1', 0.2, at('drum', 0.18))
        drum!.triggerAttackRelease('C1', 0.3, at('drum', 0.36))
        metal!.triggerAttackRelease('C3', 0.8, at('metal', 0.36))
      })
    },
  }
}
