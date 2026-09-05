import { describe, expect, it } from 'vitest'
import { mulberry32, weightedPick } from './rng'

describe('mulberry32', () => {
  it('is deterministic and in [0,1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const xs = Array.from({ length: 5 }, () => a())
    expect(xs).toEqual(Array.from({ length: 5 }, () => b()))
    for (const x of xs) expect(x).toBeGreaterThanOrEqual(0)
    for (const x of xs) expect(x).toBeLessThan(1)
  })
})

describe('weightedPick', () => {
  it('picks proportionally to weight', () => {
    const rng = mulberry32(7)
    const counts = { a: 0, b: 0 }
    for (let i = 0; i < 10000; i++) counts[weightedPick(['a', 'b'], [3, 1], rng) as 'a' | 'b']++
    expect(counts.a / counts.b).toBeGreaterThan(2.6)
    expect(counts.a / counts.b).toBeLessThan(3.4)
  })

  it('never picks zero-weight items', () => {
    const rng = mulberry32(1)
    for (let i = 0; i < 1000; i++) expect(weightedPick(['a', 'b'], [0, 1], rng)).toBe('b')
  })

  it('throws when all weights are zero or lengths differ', () => {
    expect(() => weightedPick(['a'], [0], () => 0.5)).toThrow()
    expect(() => weightedPick(['a', 'b'], [1], () => 0.5)).toThrow()
  })
})
