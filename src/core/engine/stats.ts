import type { Answer } from '../types'

export const HEAT_MAX_STREAK = 15
export const MILESTONE_EVERY = 5

export function accuracy(answers: readonly Answer[]): number {
  if (answers.length === 0) return 0
  return answers.filter((a) => a.correct).length / answers.length
}

export function lastN<T>(arr: readonly T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n))
}

export function starsFor(correct: number, count: number): 1 | 2 | 3 {
  if (count === 0) return 1
  const ratio = correct / count
  if (ratio >= 0.95) return 3
  if (ratio >= 0.8) return 2
  return 1
}

export function heatFor(streak: number): number {
  return Math.min(1, streak / HEAT_MAX_STREAK)
}
