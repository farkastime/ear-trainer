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
      p.then(
        (v) => {
          clearTimeout(t)
          resolve(v)
        },
        (e) => {
          clearTimeout(t)
          reject(e)
        },
      )
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
                  entry!.sampler.add(n as Parameters<Tone.Sampler['add']>[0], file, () => {
                    entry!.notes.add(n)
                    resolve()
                  })
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
