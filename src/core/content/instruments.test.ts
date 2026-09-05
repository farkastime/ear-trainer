import { describe, expect, it } from 'vitest'
import { DEFAULT_INSTRUMENT_ID, INSTRUMENTS, SAMPLE_SOURCES, instrumentById } from './instruments'
import { CHORDS } from './chords'

const NOTE_RE = /^[A-G]#?\d$/

describe('INSTRUMENTS', () => {
  it('ships piano, organ, harp and violin with piano as default', () => {
    expect(INSTRUMENTS.map((i) => i.id)).toEqual(['piano', 'organ', 'harp', 'violin'])
    expect(DEFAULT_INSTRUMENT_ID).toBe('piano')
    expect(instrumentById('organ').name).toBe('Organ')
    expect(() => instrumentById('kazoo')).toThrow(/unknown instrument/)
  })

  it('uses root-relative baseUrl and well-formed sample maps', () => {
    for (const inst of INSTRUMENTS) {
      expect(inst.baseUrl).toBe(`/samples/${inst.id}/`)
      expect(Object.keys(inst.samples).length).toBeGreaterThanOrEqual(6)
      for (const [note, file] of Object.entries(inst.samples)) {
        expect(note).toMatch(NOTE_RE)
        expect(file).toBe(note.replace('#', 's') + '.mp3')
      }
      expect(SAMPLE_SOURCES[inst.id]).toMatch(/^https:\/\//)
      expect(inst.attribution.length).toBeGreaterThan(10)
    }
  })

  it('covers the chord range so no note is repitched more than 6 semitones', () => {
    const midi = (n: string) => {
      const m = /^([A-G])(#|b)?(\d)$/.exec(n)!
      const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C']!
      const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
      return (Number(m[3]) + 1) * 12 + base + acc
    }
    const needed = [...new Set(CHORDS.flatMap((c) => c.notes))].map(midi)
    for (const inst of INSTRUMENTS) {
      const have = Object.keys(inst.samples).map(midi)
      for (const n of needed) {
        const nearest = Math.min(...have.map((h) => Math.abs(h - n)))
        expect(nearest, `${inst.id} near midi ${n}`).toBeLessThanOrEqual(6)
      }
    }
  })
})
