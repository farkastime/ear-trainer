import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../core/engine/rng'
import { randomDuration } from './duration'

describe('randomDuration', () => {
  it('stays within 1.5–2.5 s and varies', () => {
    const rng = mulberry32(9)
    const xs = Array.from({ length: 200 }, () => randomDuration(rng))
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(1.5)
      expect(x).toBeLessThanOrEqual(2.5)
    }
    expect(new Set(xs.map((x) => x.toFixed(2))).size).toBeGreaterThan(20)
  })
})
