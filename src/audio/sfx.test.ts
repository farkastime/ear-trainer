import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock is hoisted above imports, so everything its factory touches must be hoisted too.
const { FakeSynth, synths, now } = vi.hoisted(() => {
  const now = { value: 10 }
  const synths: FakeSynth[] = []
  class FakeSynth {
    kind = 'synth'
    starts: number[] = []
    envelope = { decay: 0 }
    volume = { value: 0 }
    frequency = { value: 0, rampTo: () => {} }
    constructor() {
      synths.push(this)
    }
    toDestination() {
      return this
    }
    connect() {
      return this
    }
    /** Mirrors Tone's source assertion that start times strictly increase. */
    record(start: number) {
      const last = this.starts[this.starts.length - 1]
      if (last !== undefined && start <= last) {
        throw new Error('Start time must be strictly greater than previous start time')
      }
      this.starts.push(start)
      return this
    }
  }
  return { FakeSynth, synths, now }
})

vi.mock('tone', () => {
  class NoiseSynth extends FakeSynth {
    kind = 'noise'
    triggerAttackRelease(_duration: number, time?: number) {
      return this.record(time ?? now.value)
    }
  }
  class Pitched extends FakeSynth {
    triggerAttackRelease(_note: string, _duration: number, time?: number) {
      return this.record(time ?? now.value)
    }
  }
  class MetalSynth extends Pitched {
    kind = 'metal'
  }
  class MembraneSynth extends Pitched {
    kind = 'drum'
  }
  class Filter extends FakeSynth {
    kind = 'filter'
  }
  return { NoiseSynth, MetalSynth, MembraneSynth, Filter, now: () => now.value }
})

import { createToneSfx } from './sfx'

const by = (kind: string) => synths.find((s) => s.kind === kind)!

beforeEach(() => {
  synths.length = 0
  now.value = 10
})

describe('createToneSfx', () => {
  it('never starts the same synth twice at the same time', () => {
    const sfx = createToneSfx()
    sfx.pop()
    sfx.whoosh()
    sfx.steam()
    const noise = by('noise')
    expect(noise.starts).toHaveLength(3)
    expect(noise.starts[1]).toBeGreaterThan(noise.starts[0])
    expect(noise.starts[2]).toBeGreaterThan(noise.starts[1])
  })

  it('a repeated fanfare in the same instant does not throw and keeps times increasing', () => {
    const sfx = createToneSfx()
    expect(() => {
      sfx.fanfare()
      sfx.fanfare()
    }).not.toThrow()
    const drum = by('drum')
    expect(drum.starts).toHaveLength(6)
    for (let i = 1; i < drum.starts.length; i++) {
      expect(drum.starts[i]).toBeGreaterThan(drum.starts[i - 1])
    }
    expect(by('metal').starts).toHaveLength(2)
  })

  it('wrong is a single descending noise sweep on the noise synth', () => {
    const sfx = createToneSfx()
    sfx.wrong()
    expect(by('noise').starts).toHaveLength(1)
    expect(by('drum').starts).toHaveLength(0)
    expect(by('metal').starts).toHaveLength(0)
  })

  it('later real time wins over the monotonic floor', () => {
    const sfx = createToneSfx()
    sfx.pop()
    now.value = 20
    sfx.pop()
    expect(by('noise').starts[1]).toBe(20)
  })
})
