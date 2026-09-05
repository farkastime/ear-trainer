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
