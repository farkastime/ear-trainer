import { describe, expect, it } from 'vitest'
import type { Answer } from '../types'
import { mulberry32 } from './rng'
import { pickChord, weightsFor, type SelectionContext } from './selection'

const a = (chordId: string, correct: boolean, at = 0): Answer => ({ chordId, correct, at })

describe('weightsFor', () => {
  it('gives base weight 1 to every working-set chord', () => {
    const ctx: SelectionContext = {
      workingSet: ['red', 'yellow'],
      recentAnswers: [],
      lastAskedId: null,
      newestChordId: null,
    }
    expect(weightsFor(ctx)).toEqual([1, 1])
  })

  it('boosts the newest chord and recently missed chords', () => {
    const ctx: SelectionContext = {
      workingSet: ['red', 'yellow', 'blue'],
      recentAnswers: [a('red', false), a('red', false), a('yellow', true)],
      lastAskedId: null,
      newestChordId: 'blue',
    }
    expect(weightsFor(ctx)).toEqual([3, 1, 2.5])
  })

  it('only counts misses within the last 10 answers', () => {
    const old = Array.from({ length: 10 }, (_, i) => a('yellow', true, i))
    const ctx: SelectionContext = {
      workingSet: ['red', 'yellow'],
      recentAnswers: [a('red', false), ...old],
      lastAskedId: null,
      newestChordId: null,
    }
    expect(weightsFor(ctx)).toEqual([1, 1])
  })

  it('dampens the chord just asked', () => {
    const ctx: SelectionContext = {
      workingSet: ['red', 'yellow'],
      recentAnswers: [],
      lastAskedId: 'red',
      newestChordId: null,
    }
    expect(weightsFor(ctx)).toEqual([0.3, 1])
  })

  it('ignores newest/missed chords outside the working set', () => {
    const ctx: SelectionContext = {
      workingSet: ['red', 'yellow'],
      recentAnswers: [a('blue', false)],
      lastAskedId: null,
      newestChordId: 'blue',
    }
    expect(weightsFor(ctx)).toEqual([1, 1])
  })
})

describe('pickChord', () => {
  it('draws from the working set with the computed weights', () => {
    const rng = mulberry32(3)
    const ctx: SelectionContext = {
      workingSet: ['red', 'yellow'],
      recentAnswers: [],
      lastAskedId: null,
      newestChordId: 'yellow',
    }
    const counts = { red: 0, yellow: 0 }
    for (let i = 0; i < 5000; i++) counts[pickChord(ctx, rng) as 'red' | 'yellow']++
    expect(counts.yellow / counts.red).toBeGreaterThan(2.1)
    expect(counts.yellow / counts.red).toBeLessThan(2.9)
  })
})
