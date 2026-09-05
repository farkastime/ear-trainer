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
