import { describe, expect, it } from 'vitest'
import { instrumentById } from '../core/content/instruments'
import { nearestSamples, noteToMidi } from './notes'

describe('noteToMidi', () => {
  it('converts scientific pitch names', () => {
    expect(noteToMidi('C4')).toBe(60)
    expect(noteToMidi('C#4')).toBe(61)
    expect(noteToMidi('Bb3')).toBe(58)
    expect(noteToMidi('A0')).toBe(21)
    expect(() => noteToMidi('H4')).toThrow()
  })
})

describe('nearestSamples', () => {
  it('returns the nearest sample for each requested note, deduplicated', () => {
    const violin = instrumentById('violin')
    const subset = nearestSamples(violin, ['C4', 'E4', 'G4', 'B3'])
    expect(Object.keys(subset).sort()).toEqual(['C4', 'E4', 'G4'])
    expect(subset.C4).toBe('C4.mp3')
  })

  it('picks the closer neighbour for in-between notes', () => {
    const piano = instrumentById('piano')
    expect(Object.keys(nearestSamples(piano, ['D4']))).toEqual(['D#4'])
    expect(Object.keys(nearestSamples(piano, ['B3']))).toEqual(['C4'])
  })
})
