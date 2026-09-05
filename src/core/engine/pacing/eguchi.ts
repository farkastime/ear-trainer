import { lastN } from '../stats'
import type { PacingPolicy } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

export const eguchi: PacingPolicy = (input, params) => {
  const { progression, now } = input
  const window = lastN(progression.recentAnswers, params.eguchiWindow)
  const misses = window.filter((a) => !a.correct).length
  if (window.length < params.eguchiWindow || misses > 0) {
    return {
      ready: false,
      reason: `accuracy: ${window.length - misses}/${params.eguchiWindow} correct in window`,
    }
  }

  const lastUnlockAt = Math.max(...progression.unlocks.map((u) => u.unlockedAt))
  const days = (now - lastUnlockAt) / DAY_MS
  if (days < params.eguchiDays) {
    return {
      ready: false,
      reason: `${Math.floor(days)} of ${params.eguchiDays} days since last unlock`,
    }
  }

  const sessionsSince = progression.sessions.filter(
    (s) => s.countsForPacing && s.endedAt > lastUnlockAt,
  ).length
  if (sessionsSince < params.eguchiSessions) {
    return {
      ready: false,
      reason: `${sessionsSince} of ${params.eguchiSessions} sessions since last unlock`,
    }
  }

  return { ready: true, reason: 'perfect window, spacing and sessions met' }
}
