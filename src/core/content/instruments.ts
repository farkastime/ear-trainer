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
    id: 'piano',
    name: 'Piano',
    emoji: '🎹',
    baseUrl: '/samples/piano/',
    release: 1.2,
    samples: map([
      'A2',
      'C3',
      'D#3',
      'F#3',
      'A3',
      'C4',
      'D#4',
      'F#4',
      'A4',
      'C5',
      'D#5',
      'F#5',
      'A5',
      'C6',
    ]),
    attribution: 'Salamander Grand Piano by Alexander Holm, CC-BY 3.0, via tonejs.github.io',
  },
  {
    id: 'organ',
    name: 'Organ',
    emoji: '🎛️',
    baseUrl: '/samples/organ/',
    release: 0.6,
    samples: map([
      'A2',
      'C3',
      'D#3',
      'F#3',
      'A3',
      'C4',
      'D#4',
      'F#4',
      'A4',
      'C5',
      'D#5',
      'F#5',
      'A5',
      'C6',
    ]),
    attribution: 'VSCO 2 Community Edition organ via nbrosowsky/tonejs-instruments, CC-BY 3.0',
  },
  {
    id: 'harp',
    name: 'Harp',
    emoji: '🪕',
    baseUrl: '/samples/harp/',
    release: 2.0,
    samples: map(['A2', 'C3', 'E3', 'G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5', 'G5', 'B5']),
    attribution: 'VSCO 2 Community Edition harp via nbrosowsky/tonejs-instruments, CC-BY 3.0',
  },
  {
    id: 'violin',
    name: 'Strings',
    emoji: '🎻',
    baseUrl: '/samples/violin/',
    release: 1.0,
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
