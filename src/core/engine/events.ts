import type { SessionSummary } from '../types'

export type EngineEvent =
  | { type: 'sessionStarted'; workingSetSize: number }
  | { type: 'questionAsked'; chordId: string }
  | {
      type: 'answered'
      chordId: string
      chosenId: string
      correct: boolean
      streak: number
      heat: number
    }
  | { type: 'streakMilestone'; streak: number }
  | { type: 'workingSetChanged'; size: number }
  | { type: 'chordWoken'; chordId: string }
  | { type: 'readyForUnlock' }
  | { type: 'levelUp'; chordId: string; level: number }
  | { type: 'chordNapped'; chordId: string }
  | { type: 'sessionComplete'; summary: SessionSummary }
