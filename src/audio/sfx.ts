import * as Tone from 'tone'

const MIN_GAP_S = 0.005

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
    whoosh: rec('whoosh'),
    pop: rec('pop'),
    thud: rec('thud'),
    cymbal: rec('cymbal'),
    steam: rec('steam'),
    fanfare: rec('fanfare'),
  }
}

export function createToneSfx(): Sfx {
  let noise: Tone.NoiseSynth | null = null
  let metal: Tone.MetalSynth | null = null
  let drum: Tone.MembraneSynth | null = null
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
