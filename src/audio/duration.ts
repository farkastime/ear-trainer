import type { Rng } from '../core/engine/rng'

const MEAN = 2
const SD = 0.3
const MIN = 1.5
const MAX = 2.5

export function randomDuration(rng: Rng): number {
  const u = Math.max(rng(), 1e-9)
  const v = rng()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return Math.min(MAX, Math.max(MIN, MEAN + SD * z))
}
