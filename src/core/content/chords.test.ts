import { describe, expect, it } from 'vitest'
import { CHORDS, chordById } from './chords'

describe('CHORDS', () => {
  it('has the 14 curriculum chords in Eguchi order', () => {
    expect(CHORDS.map((c) => c.id)).toEqual([
      'red',
      'yellow',
      'blue',
      'black',
      'green',
      'orange',
      'purple',
      'pink',
      'brown',
      'gray',
      'tan',
      'lightgreen',
      'lightpurple',
      'skyblue',
    ])
  })

  it('uses the exact Eguchi voicings', () => {
    const voicings = Object.fromEntries(CHORDS.map((c) => [c.id, c.notes.join(' ')]))
    expect(voicings).toEqual({
      red: 'C4 E4 G4',
      yellow: 'C4 F4 A4',
      blue: 'B3 D4 G4',
      black: 'A3 C4 F4',
      green: 'D4 G4 B4',
      orange: 'E4 G4 C5',
      purple: 'F4 A4 C5',
      pink: 'G4 B4 D5',
      brown: 'G4 C5 E5',
      gray: 'A3 C#4 E4',
      tan: 'D4 F#4 A4',
      lightgreen: 'E4 G#4 B4',
      lightpurple: 'Bb3 D4 F4',
      skyblue: 'Eb4 G4 Bb4',
    })
  })

  it('has unique ids, colors and emoji', () => {
    const unique = (xs: string[]) => new Set(xs).size === xs.length
    expect(unique(CHORDS.map((c) => c.id))).toBe(true)
    expect(unique(CHORDS.map((c) => c.color))).toBe(true)
    expect(unique(CHORDS.map((c) => c.character.emoji))).toBe(true)
  })

  it('looks up by id and throws on unknown', () => {
    expect(chordById('black').character.name).toBe('Owl')
    expect(() => chordById('nope')).toThrow(/unknown chord/)
  })
})
