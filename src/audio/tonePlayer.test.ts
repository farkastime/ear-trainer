import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock is hoisted above imports, so everything its factory touches must be hoisted too.
const { FakeSampler, samplers, start, resume } = vi.hoisted(() => {
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
    toDestination() {
      return this
    }
    add(note: string, url: string, cb?: () => void) {
      this.added[note] = url
      cb?.()
      return this
    }
    triggerAttackRelease(notes: string[], duration: number) {
      this.triggered.push({ notes, duration })
      return this
    }
    releaseAll() {
      this.released++
      return this
    }
  }
  const samplers: FakeSampler[] = []
  return { FakeSampler, samplers, start: vi.fn(async () => {}), resume: vi.fn(async () => {}) }
})
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
