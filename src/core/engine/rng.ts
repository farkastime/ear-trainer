export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function weightedPick<T>(items: readonly T[], weights: readonly number[], rng: Rng): T {
  if (items.length !== weights.length) throw new Error('weightedPick: length mismatch')
  const total = weights.reduce((s, w) => s + w, 0)
  if (total <= 0) throw new Error('weightedPick: all weights zero')
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r < 0 && weights[i] > 0) return items[i]
  }
  for (let i = items.length - 1; i >= 0; i--) if (weights[i] > 0) return items[i]
  throw new Error('weightedPick: unreachable')
}
