import type { Progression, Unlock } from '../types'
import { CHORDS } from './chords'

export const DEFAULT_CURRICULUM: readonly string[] = CHORDS.map((c) => c.id)
export const MAX_LEVEL = DEFAULT_CURRICULUM.length - 1

export function levelOf(unlocks: readonly Unlock[]): number {
  return unlocks.length - 1
}

export function unlockedChordIds(unlocks: readonly Unlock[]): string[] {
  return unlocks.map((u) => u.chordId)
}

export function newestUnlockedId(unlocks: readonly Unlock[]): string {
  return unlocks[unlocks.length - 1].chordId
}

export function nextChordId(unlocks: readonly Unlock[]): string | null {
  return DEFAULT_CURRICULUM[unlocks.length] ?? null
}

export function awakeChordIds(progression: Progression): string[] {
  return unlockedChordIds(progression.unlocks).filter((id) => id !== progression.napping)
}

export function initialUnlocks(now: number): Unlock[] {
  return DEFAULT_CURRICULUM.slice(0, 2).map((chordId) => ({ chordId, unlockedAt: now }))
}

export function isChampion(progression: Progression): boolean {
  return progression.unlocks.length === DEFAULT_CURRICULUM.length
}
