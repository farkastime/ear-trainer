import type { Answer } from '../types'
import { type Rng, weightedPick } from './rng'
import { lastN } from './stats'

export const NEWEST_BONUS = 1.5
export const MISS_BONUS = 1
export const MISS_WINDOW = 10
export const REPEAT_FACTOR = 0.3

export interface SelectionContext {
  workingSet: string[]
  recentAnswers: Answer[]
  lastAskedId: string | null
  newestChordId: string | null
}

export function weightsFor(ctx: SelectionContext): number[] {
  const recentMisses = lastN(ctx.recentAnswers, MISS_WINDOW).filter((a) => !a.correct)
  return ctx.workingSet.map((id) => {
    let w = 1
    if (id === ctx.newestChordId) w += NEWEST_BONUS
    w += MISS_BONUS * recentMisses.filter((a) => a.chordId === id).length
    if (id === ctx.lastAskedId) w *= REPEAT_FACTOR
    return w
  })
}

export function pickChord(ctx: SelectionContext, rng: Rng): string {
  return weightedPick(ctx.workingSet, weightsFor(ctx), rng)
}
