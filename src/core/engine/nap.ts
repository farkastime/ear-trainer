import type { Progression } from '../types'
import { lastN } from './stats'

export const NAP_ACCURACY = 0.7
export const NAP_SESSIONS = 2
export const WAKE_STREAK = 5
export const MIN_AWAKE = 2

export function shouldNap(progression: Progression): boolean {
  if (progression.napping !== null) return false
  if (progression.unlocks.length - 1 < MIN_AWAKE) return false
  const eligible = progression.sessions.filter(
    (s) => s.countsForPacing && s.endedAt > progression.lastNapChangeAt,
  )
  const recent = lastN(eligible, NAP_SESSIONS)
  if (recent.length < NAP_SESSIONS) return false
  return recent.every((s) => s.correct / s.count < NAP_ACCURACY)
}

export function shouldWake(progression: Progression, sessionStreak: number): boolean {
  return progression.napping !== null && sessionStreak >= WAKE_STREAK
}
