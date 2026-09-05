import type { Answer } from '../types'
import { accuracy, lastN } from './stats'

export const IDLE_MS = 7 * 24 * 60 * 60 * 1000
export const NARROW_MIN_ANSWERS = 5
export const NARROW_WINDOW = 8
export const NARROW_THRESHOLD = 0.6
export const WIDEN_STREAK = 3
export const MIN_WORKING_SET = 2

export interface WorkingSet {
  size: number
  widenStreak: number
  lastNarrowedAtCount: number
}

export function initialWorkingSet(
  awakeCount: number,
  lastSessionEndedAt: number | null,
  now: number,
): WorkingSet {
  const idle = lastSessionEndedAt !== null && now - lastSessionEndedAt > IDLE_MS
  const size = idle ? Math.max(MIN_WORKING_SET, Math.ceil(awakeCount / 2)) : awakeCount
  return { size: Math.min(size, awakeCount), widenStreak: 0, lastNarrowedAtCount: -Infinity }
}

export function updateWorkingSet(
  ws: WorkingSet,
  awakeCount: number,
  sessionAnswers: readonly Answer[],
): WorkingSet {
  const last = sessionAnswers[sessionAnswers.length - 1]
  let { size, widenStreak, lastNarrowedAtCount } = ws
  size = Math.min(size, awakeCount)

  if (last.correct) {
    widenStreak += 1
    if (widenStreak >= WIDEN_STREAK && size < awakeCount) {
      size += 1
      widenStreak = 0
    }
  } else {
    widenStreak = 0
  }

  const count = sessionAnswers.length
  const windowAccuracy = accuracy(lastN(sessionAnswers, NARROW_WINDOW))
  const cooledDown = count - lastNarrowedAtCount >= NARROW_WINDOW
  if (
    !last.correct &&
    count >= NARROW_MIN_ANSWERS &&
    windowAccuracy < NARROW_THRESHOLD &&
    cooledDown
  ) {
    size = Math.max(MIN_WORKING_SET, Math.floor(size / 2))
    lastNarrowedAtCount = count
  }

  return { size, widenStreak, lastNarrowedAtCount }
}
