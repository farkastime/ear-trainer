import type { Answer } from '../types'
import { type Rng, weightedPick } from './rng'
import { lastN } from './stats'

export const NEWEST_BONUS = 1.5
export const MISS_BONUS = 1
export const MISS_WINDOW = 10
export const REPEAT_FACTOR = 0.3
/** A chord is never asked more than this many times in a row. */
export const MAX_CONSECUTIVE = 2

export interface SelectionContext {
  workingSet: string[]
  recentAnswers: Answer[]
  lastAskedId: string | null
  /** Chord ids of the most recent questions, oldest first (at least the last two). */
  recentAskedIds?: string[]
  newestChordId: string | null
}

function askedConsecutively(ctx: SelectionContext, id: string): number {
  const asked = ctx.recentAskedIds ?? (ctx.lastAskedId ? [ctx.lastAskedId] : [])
  let n = 0
  for (let i = asked.length - 1; i >= 0 && asked[i] === id; i--) n++
  return n
}

export function weightsFor(ctx: SelectionContext): number[] {
  const recentMisses = lastN(ctx.recentAnswers, MISS_WINDOW).filter((a) => !a.correct)
  const weights = ctx.workingSet.map((id) => {
    let w = 1
    if (id === ctx.newestChordId) w += NEWEST_BONUS
    w += MISS_BONUS * recentMisses.filter((a) => a.chordId === id).length
    if (id === ctx.lastAskedId) w *= REPEAT_FACTOR
    if (ctx.workingSet.length > 1 && askedConsecutively(ctx, id) >= MAX_CONSECUTIVE) w = 0
    return w
  })
  return weights
}

export function pickChord(ctx: SelectionContext, rng: Rng): string {
  return weightedPick(ctx.workingSet, weightsFor(ctx), rng)
}
