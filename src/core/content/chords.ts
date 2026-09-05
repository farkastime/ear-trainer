import type { Chord } from '../types'

export const CHORDS: readonly Chord[] = [
  {
    id: 'red',
    notes: ['C4', 'E4', 'G4'],
    label: 'C',
    color: '#e53935',
    character: { name: 'Lion', emoji: '🦁', mood: 'bright' },
  },
  {
    id: 'yellow',
    notes: ['C4', 'F4', 'A4'],
    label: 'F/C',
    color: '#fdd835',
    character: { name: 'Chick', emoji: '🐥', mood: 'bright' },
  },
  {
    id: 'blue',
    notes: ['B3', 'D4', 'G4'],
    label: 'G/B',
    color: '#1e88e5',
    character: { name: 'Whale', emoji: '🐳', mood: 'calm' },
  },
  {
    id: 'black',
    notes: ['A3', 'C4', 'F4'],
    label: 'F/A',
    color: '#212121',
    character: { name: 'Owl', emoji: '🦉', mood: 'night' },
  },
  {
    id: 'green',
    notes: ['D4', 'G4', 'B4'],
    label: 'G/D',
    color: '#43a047',
    character: { name: 'Frog', emoji: '🐸', mood: 'bright' },
  },
  {
    id: 'orange',
    notes: ['E4', 'G4', 'C5'],
    label: 'C/E',
    color: '#fb8c00',
    character: { name: 'Fox', emoji: '🦊', mood: 'bright' },
  },
  {
    id: 'purple',
    notes: ['F4', 'A4', 'C5'],
    label: 'F',
    color: '#8e24aa',
    character: { name: 'Unicorn', emoji: '🦄', mood: 'bright' },
  },
  {
    id: 'pink',
    notes: ['G4', 'B4', 'D5'],
    label: 'G',
    color: '#ec407a',
    character: { name: 'Flamingo', emoji: '🦩', mood: 'bright' },
  },
  {
    id: 'brown',
    notes: ['G4', 'C5', 'E5'],
    label: 'C/G',
    color: '#6d4c41',
    character: { name: 'Bear', emoji: '🐻', mood: 'calm' },
  },
  {
    id: 'gray',
    notes: ['A3', 'C#4', 'E4'],
    label: 'A',
    color: '#9e9e9e',
    character: { name: 'Elephant', emoji: '🐘', mood: 'calm' },
  },
  {
    id: 'tan',
    notes: ['D4', 'F#4', 'A4'],
    label: 'D',
    color: '#d2b48c',
    character: { name: 'Camel', emoji: '🐪', mood: 'bright' },
  },
  {
    id: 'lightgreen',
    notes: ['E4', 'G#4', 'B4'],
    label: 'E',
    color: '#9ccc65',
    character: { name: 'Turtle', emoji: '🐢', mood: 'calm' },
  },
  {
    id: 'lightpurple',
    notes: ['Bb3', 'D4', 'F4'],
    label: 'Bb',
    color: '#ce93d8',
    character: { name: 'Octopus', emoji: '🐙', mood: 'night' },
  },
  {
    id: 'skyblue',
    notes: ['Eb4', 'G4', 'Bb4'],
    label: 'Eb',
    color: '#4fc3f7',
    character: { name: 'Dolphin', emoji: '🐬', mood: 'bright' },
  },
]

const BY_ID = new Map(CHORDS.map((c) => [c.id, c]))

export function chordById(id: string): Chord {
  const chord = BY_ID.get(id)
  if (!chord) throw new Error(`unknown chord: ${id}`)
  return chord
}
