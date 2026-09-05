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
    notes: string[] = []
    triggerAttackRelease(note: string, _duration: number, time?: number) {
      this.notes.push(note)
      return this.record(time ?? now.value)
    }
  }
  class MetalSynth extends Pitched {
    kind = 'metal'
  }
  class MembraneSynth extends Pitched {
    kind = 'drum'
  }
  class Synth extends Pitched {
    kind = 'blip'
  }
  class Filter extends FakeSynth {
    kind = 'filter'
  }
  return { NoiseSynth, MetalSynth, MembraneSynth, Synth, Filter, now: () => now.value }
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

  it('wrong is a descending two-tone blip on its own synth', () => {
    const sfx = createToneSfx()
    sfx.wrong()
    const blip = by('blip')
    expect(blip.starts).toHaveLength(2)
    expect(blip.starts[1]).toBeGreaterThan(blip.starts[0])
    expect(by('noise').starts).toHaveLength(0)
    expect(by('drum').starts).toHaveLength(0)
  })

  it('the get-ready cue arpeggiates the chord plus its octave, an octave up', () => {
    const sfx = createToneSfx()
    sfx.readyArpeggio(['C4', 'F4', 'A4'])
    const bell = synths.filter((s) => s.kind === 'blip')[1] as InstanceType<typeof FakeSynth> & {
      notes: string[]
    }
    expect(bell.notes).toEqual(['C5', 'F5', 'A5', 'C6'])
    expect(bell.starts).toHaveLength(4)
    expect(by('noise').starts).toHaveLength(0)
  })

  it('the level-up jingle is transposed into the key it is given', () => {
    const sfx = createToneSfx()
    sfx.jingleLevelUp('C')
    sfx.jingleLevelUp('F')
    sfx.jingleLevelUp('Bb')
    const bell = synths.filter((s) => s.kind === 'blip')[1] as InstanceType<typeof FakeSynth> & {
      notes: string[]
    }
    expect(bell.notes.slice(0, 6)).toEqual(['C6', 'E6', 'G6', 'C7', 'G6', 'C7'])
    expect(bell.notes.slice(6, 12)).toEqual(['F5', 'A5', 'C6', 'F6', 'C6', 'F6'])
    expect(bell.notes.slice(12, 18)).toEqual(['A#5', 'D6', 'F6', 'A#6', 'F6', 'A#6'])
  })

  it("a correct answer dings the chord's outer notes an octave up", () => {
    const sfx = createToneSfx()
    sfx.correct(['B3', 'D4', 'G4'])
    const bell = synths.filter((s) => s.kind === 'blip')[1] as InstanceType<typeof FakeSynth> & {
      notes: string[]
    }
    expect(bell.notes).toEqual(['B4', 'G5'])
    expect(bell.starts).toHaveLength(2)
    expect(bell.starts[1] - bell.starts[0]).toBeCloseTo(0.12)
    expect(by('noise').starts).toHaveLength(0)
  })

  it('the milestone chime is the whole chord an octave up, in order', () => {
    const sfx = createToneSfx()
    sfx.milestone(['C4', 'E4', 'G4'])
    const bell = synths.filter((s) => s.kind === 'blip')[1] as InstanceType<typeof FakeSynth> & {
      notes: string[]
    }
    expect(bell.notes).toEqual(['C5', 'E5', 'G5'])
    expect(bell.starts).toHaveLength(3)
    expect(by('noise').starts).toHaveLength(0)
  })

  it('jingles play their notes in strictly increasing time on the bell synth', () => {
    const sfx = createToneSfx()
    sfx.jingleLevelUp('C')
    sfx.jingleSessionEnd()
    const bells = synths.filter((s) => s.kind === 'blip')
    // Two Synth instances exist: the miss blip (created first) and the jingle bell.
    expect(bells).toHaveLength(2)
    const bell = bells[1]
    expect(bell.starts).toHaveLength(6 + 4)
    for (let i = 1; i < bell.starts.length; i++) {
      expect(bell.starts[i]).toBeGreaterThan(bell.starts[i - 1])
    }
  })

  it('later real time wins over the monotonic floor', () => {
    const sfx = createToneSfx()
    sfx.pop()
    now.value = 20
    sfx.pop()
    expect(by('noise').starts[1]).toBe(20)
  })
})
