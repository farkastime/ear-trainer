export type Mood = 'bright' | 'calm' | 'night' | 'sad' | 'mysterious'

export interface Character {
  name: string
  emoji: string
  mood: Mood
  /** When set, the UI renders this instead of the emoji. Empty in v1. */
  artUrl?: string
}

export interface Chord {
  id: string
  /** Exact Eguchi voicing with octaves; part of the method, do not re-voice. */
  notes: readonly string[]
  label: string
  color: string
  character: Character
}

export interface Instrument {
  id: string
  name: string
  emoji: string
  baseUrl: string
  /** note name -> file name relative to baseUrl */
  samples: Readonly<Record<string, string>>
  release: number
  attribution: string
}

export type PacingPolicyId = 'unlimited' | 'eguchi' | 'manual'

export interface PacingParams {
  streakTarget: number
  eguchiWindow: number
  eguchiDays: number
  eguchiSessions: number
}

export type Intensity = 'full' | 'medium' | 'calm'

export interface ProfileSettings {
  pacing: PacingPolicyId
  pacingParams: PacingParams
  instrumentId: string
  sessionTarget: number
  showLetters: boolean
  intensity: Intensity
  celebrationSound: boolean
  haptics: boolean
  /** Practice grid on Home shows every chord (locked ones as colour only) instead of just unlocked ones. */
  practiceAll: boolean
}

export interface Answer {
  chordId: string
  correct: boolean
  at: number
}

export interface SessionSummary {
  startedAt: number
  endedAt: number
  count: number
  correct: number
  levelAtStart: number
  stars: number
  leveledUp: boolean
  /** false for early exits shorter than half the target */
  countsForPacing: boolean
}

export interface Unlock {
  chordId: string
  unlockedAt: number
}

export interface ChordStat {
  attempts: number
  correct: number
}

export interface Progression {
  unlocks: Unlock[]
  napping: string | null
  /** Sessions before this timestamp are ignored by the nap rule. */
  lastNapChangeAt: number
  streak: number
  bestStreak: number
  heat: number
  chordStats: Record<string, ChordStat>
  /** Rolling window, newest last, capped at RECENT_ANSWERS_CAP. */
  recentAnswers: Answer[]
  sessions: SessionSummary[]
  stars: number
  /** Manual pacing only: the Unlimited rule fired and a parent may unlock. */
  readyForUnlock: boolean
}

export interface Profile {
  id: string
  name: string
  avatarEmoji: string
  createdAt: number
  settings: ProfileSettings
  progression: Progression
}

export const RECENT_ANSWERS_CAP = 100
