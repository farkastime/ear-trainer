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
