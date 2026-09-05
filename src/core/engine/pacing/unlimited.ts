import type { PacingPolicy } from './types'

export const unlimited: PacingPolicy = (input, params) => {
  if (input.sessionStreak < params.streakTarget) {
    return { ready: false, reason: `streak ${input.sessionStreak} of ${params.streakTarget}` }
  }
  return { ready: true, reason: `streak of ${input.sessionStreak}` }
}
