import { describe, expect, it } from 'vitest'
import { instrumentById } from '../core/content/instruments'
import { midiToNote, nearestSamples, noteToMidi, transpose } from './notes'

describe('noteToMidi', () => {
  it('converts scientific pitch names', () => {
    expect(noteToMidi('C4')).toBe(60)
    expect(noteToMidi('C#4')).toBe(61)
    expect(noteToMidi('Bb3')).toBe(58)
    expect(noteToMidi('A0')).toBe(21)
    expect(() => noteToMidi('H4')).toThrow()
  })
})

describe('midiToNote and transpose', () => {
  it('round-trips and transposes by an octave', () => {
    expect(midiToNote(60)).toBe('C4')
    expect(midiToNote(61)).toBe('C#4')
    expect(midiToNote(noteToMidi('Bb3'))).toBe('A#3')
    expect(transpose(['C4', 'E4', 'G4'], 12)).toEqual(['C5', 'E5', 'G5'])
    expect(transpose(['B3', 'D4', 'G4'], 12)).toEqual(['B4', 'D5', 'G5'])
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
