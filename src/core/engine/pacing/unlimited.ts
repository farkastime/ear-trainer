import type { PacingPolicy } from './types'

export const unlimited: PacingPolicy = (input, params) => {
  if (input.sessionStreak < params.streakTarget) {
    return { ready: false, reason: `streak ${input.sessionStreak} of ${params.streakTarget}` }
  }
  const missing = input.awakeChordIds.filter((id) => !input.streakChordIds.has(id))
  if (missing.length > 0) {
    return { ready: false, reason: `not yet correct in this streak: ${missing.join(', ')}` }
  }
  return { ready: true, reason: `streak of ${input.sessionStreak}` }
}
