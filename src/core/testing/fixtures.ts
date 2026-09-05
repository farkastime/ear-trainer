import { DEFAULT_INSTRUMENT_ID } from '../content/instruments'
import { DEFAULT_PACING_PARAMS } from '../engine/pacing'
import type { Profile, ProfileSettings, Progression } from '../types'

export function makeProgression(over: Partial<Progression> = {}): Progression {
  return {
    unlocks: [
      { chordId: 'red', unlockedAt: 0 },
      { chordId: 'yellow', unlockedAt: 0 },
    ],
    napping: null,
    lastNapChangeAt: 0,
    streak: 0,
    bestStreak: 0,
    heat: 0,
    chordStats: {},
    recentAnswers: [],
    sessions: [],
    stars: 0,
    readyForUnlock: false,
    ...over,
  }
}

export const DEFAULT_TEST_SETTINGS: ProfileSettings = {
  pacing: 'unlimited',
  pacingParams: DEFAULT_PACING_PARAMS,
  instrumentId: DEFAULT_INSTRUMENT_ID,
  sessionTarget: 20,
  showLetters: false,
  intensity: 'full',
  celebrationSound: true,
  haptics: true,
}

export function makeProfile(
  over: { settings?: Partial<ProfileSettings>; progression?: Partial<Progression> } = {},
): Profile {
  return {
    id: 'p1',
    name: 'Test Kid',
    avatarEmoji: '🐱',
    createdAt: 0,
    settings: { ...DEFAULT_TEST_SETTINGS, ...over.settings },
    progression: makeProgression(over.progression),
  }
}
