import { describe, expect, it } from 'vitest'
import type { Answer } from '../types'
import { HEAT_MAX_STREAK, accuracy, heatFor, lastN, starsFor } from './stats'

const ans = (correct: boolean, i = 0): Answer => ({ chordId: 'red', correct, at: i })

describe('stats', () => {
  it('accuracy is 0 for empty and a ratio otherwise', () => {
    expect(accuracy([])).toBe(0)
    expect(accuracy([ans(true), ans(false), ans(true), ans(true)])).toBe(0.75)
  })

  it('lastN returns the tail without mutating', () => {
    const xs = [1, 2, 3, 4]
    expect(lastN(xs, 2)).toEqual([3, 4])
    expect(lastN(xs, 10)).toEqual([1, 2, 3, 4])
    expect(xs).toEqual([1, 2, 3, 4])
  })

  it('stars follow the spec thresholds', () => {
    expect(starsFor(20, 20)).toBe(3)
    expect(starsFor(19, 20)).toBe(3)
    expect(starsFor(18, 20)).toBe(2)
    expect(starsFor(16, 20)).toBe(2)
    expect(starsFor(15, 20)).toBe(1)
    expect(starsFor(0, 0)).toBe(1)
  })

  it('heat ramps to 1 at HEAT_MAX_STREAK', () => {
    expect(HEAT_MAX_STREAK).toBe(15)
    expect(heatFor(0)).toBe(0)
    expect(heatFor(5)).toBeCloseTo(1 / 3)
    expect(heatFor(15)).toBe(1)
    expect(heatFor(40)).toBe(1)
  })
})
