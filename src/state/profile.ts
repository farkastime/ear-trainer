import { initialUnlocks } from '../core/content/curriculum'
import { DEFAULT_INSTRUMENT_ID } from '../core/content/instruments'
import { DEFAULT_PACING_PARAMS, clampPacingParams } from '../core/engine/pacing'
import type { Profile, ProfileSettings } from '../core/types'

export const SESSION_TARGET_LIMITS: [number, number] = [10, 50]

export const DEFAULT_SETTINGS: ProfileSettings = {
  pacing: 'unlimited',
  pacingParams: DEFAULT_PACING_PARAMS,
  instrumentId: DEFAULT_INSTRUMENT_ID,
  sessionTarget: 20,
  showLetters: false,
  intensity: 'full',
  celebrationSound: true,
  haptics: true,
}

export function clampSettings(settings: ProfileSettings): ProfileSettings {
  const [min, max] = SESSION_TARGET_LIMITS
  const sessionTarget = Number.isFinite(settings.sessionTarget)
    ? settings.sessionTarget
    : DEFAULT_SETTINGS.sessionTarget
  return {
    ...settings,
    sessionTarget: Math.min(max, Math.max(min, Math.round(sessionTarget))),
    pacingParams: clampPacingParams(settings.pacingParams),
  }
}

export function newProfile(name: string, avatarEmoji: string, now: number, id: string): Profile {
  return {
    id,
    name,
    avatarEmoji,
    createdAt: now,
    settings: DEFAULT_SETTINGS,
    progression: {
      unlocks: initialUnlocks(now),
      napping: null,
      lastNapChangeAt: now,
      streak: 0,
      bestStreak: 0,
      heat: 0,
      chordStats: {},
      recentAnswers: [],
      sessions: [],
      stars: 0,
      readyForUnlock: false,
    },
  }
}
