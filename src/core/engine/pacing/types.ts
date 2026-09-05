import type { PacingParams, Progression } from '../../types'

export interface PacingInput {
  progression: Progression
  sessionStreak: number
  /** Chords answered correctly within the current streak. */
  streakChordIds: ReadonlySet<string>
  awakeChordIds: string[]
  now: number
}

export interface PacingVerdict {
  ready: boolean
  reason: string
}

export type PacingPolicy = (input: PacingInput, params: PacingParams) => PacingVerdict
