import { describe, expect, it } from 'vitest'
import type { Answer, Progression, SessionSummary } from '../../types'
import { DEFAULT_PACING_PARAMS, clampPacingParams, policyFor } from './index'
import type { PacingInput } from './types'

const DAY = 24 * 60 * 60 * 1000

function progression(over: Partial<Progression> = {}): Progression {
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

function input(over: Partial<PacingInput> = {}): PacingInput {
  return {
    progression: progression(),
    sessionStreak: 0,
    streakChordIds: new Set(),
    awakeChordIds: ['red', 'yellow'],
    now: 0,
    ...over,
  }
}

const answers = (n: number, correct = true): Answer[] =>
  Array.from({ length: n }, (_, i) => ({ chordId: i % 2 ? 'red' : 'yellow', correct, at: i }))

const session = (endedAt: number, countsForPacing = true): SessionSummary => ({
  startedAt: endedAt - 1000,
  endedAt,
  count: 20,
  correct: 20,
  levelAtStart: 1,
  stars: 3,
  leveledUp: false,
  countsForPacing,
})

describe('unlimited', () => {
  const unlimited = policyFor('unlimited')
  it('is ready at the streak target when every awake chord was hit', () => {
    const v = unlimited(
      input({ sessionStreak: 10, streakChordIds: new Set(['red', 'yellow']) }),
      DEFAULT_PACING_PARAMS,
    )
    expect(v.ready).toBe(true)
  })
  it('is not ready below the target', () => {
    const v = unlimited(
      input({ sessionStreak: 9, streakChordIds: new Set(['red', 'yellow']) }),
      DEFAULT_PACING_PARAMS,
    )
    expect(v.ready).toBe(false)
    expect(v.reason).toMatch(/9 of 10/)
  })
  it('is not ready if some awake chord was never in the streak', () => {
    const v = unlimited(
      input({ sessionStreak: 12, streakChordIds: new Set(['red']) }),
      DEFAULT_PACING_PARAMS,
    )
    expect(v.ready).toBe(false)
    expect(v.reason).toMatch(/yellow/)
  })
  it('honours a custom target', () => {
    const v = unlimited(input({ sessionStreak: 3, streakChordIds: new Set(['red', 'yellow']) }), {
      ...DEFAULT_PACING_PARAMS,
      streakTarget: 3,
    })
    expect(v.ready).toBe(true)
  })
})

describe('eguchi', () => {
  const eguchi = policyFor('eguchi')
  const params = { ...DEFAULT_PACING_PARAMS, eguchiWindow: 4, eguchiDays: 14, eguchiSessions: 2 }
  const ready = progression({
    recentAnswers: answers(4),
    sessions: [session(DAY), session(2 * DAY)],
  })

  it('is ready with perfect window, enough days, and enough counted sessions', () => {
    expect(eguchi(input({ progression: ready, now: 15 * DAY }), params).ready).toBe(true)
  })
  it('blocks on a single miss in the window', () => {
    const p = {
      ...ready,
      recentAnswers: [...answers(3), { chordId: 'red', correct: false, at: 9 }],
    }
    const v = eguchi(input({ progression: p, now: 15 * DAY }), params)
    expect(v.ready).toBe(false)
    expect(v.reason).toMatch(/accuracy/)
  })
  it('blocks when the window is not yet full', () => {
    const p = { ...ready, recentAnswers: answers(3) }
    expect(eguchi(input({ progression: p, now: 15 * DAY }), params).ready).toBe(false)
  })
  it('blocks before enough days since the last unlock', () => {
    const v = eguchi(input({ progression: ready, now: 13 * DAY }), params)
    expect(v.ready).toBe(false)
    expect(v.reason).toMatch(/day/)
  })
  it('counts only sessions that count for pacing and happened after the last unlock', () => {
    const p = {
      ...ready,
      unlocks: [
        { chordId: 'red', unlockedAt: 0 },
        { chordId: 'yellow', unlockedAt: 1.5 * DAY },
      ],
      sessions: [session(DAY), session(2 * DAY), session(3 * DAY, false)],
    }
    const v = eguchi(input({ progression: p, now: 20 * DAY }), params)
    expect(v.ready).toBe(false)
    expect(v.reason).toMatch(/session/)
  })
  it('zero days and zero sessions collapse to the accuracy rule alone', () => {
    const p = progression({ recentAnswers: answers(4) })
    const v = eguchi(input({ progression: p, now: 0 }), {
      ...params,
      eguchiDays: 0,
      eguchiSessions: 0,
    })
    expect(v.ready).toBe(true)
  })
  it('is never ready with no unlocks', () => {
    const p = progression({ unlocks: [], recentAnswers: answers(4) })
    const v = eguchi(input({ progression: p, now: 100 * DAY }), {
      ...params,
      eguchiDays: 0,
      eguchiSessions: 0,
    })
    expect(v.ready).toBe(false)
    expect(v.reason).toMatch(/no unlocked/)
  })
})

describe('manual', () => {
  it('is never ready', () => {
    const v = policyFor('manual')(
      input({ sessionStreak: 50, streakChordIds: new Set(['red', 'yellow']) }),
      DEFAULT_PACING_PARAMS,
    )
    expect(v.ready).toBe(false)
  })
})

describe('clampPacingParams', () => {
  it('clamps to the spec ranges', () => {
    expect(
      clampPacingParams({
        streakTarget: 1,
        eguchiWindow: 999,
        eguchiDays: -3,
        eguchiSessions: 500,
      }),
    ).toEqual({ streakTarget: 3, eguchiWindow: 200, eguchiDays: 0, eguchiSessions: 100 })
    expect(clampPacingParams(DEFAULT_PACING_PARAMS)).toEqual(DEFAULT_PACING_PARAMS)
  })

  it('falls back to defaults for non-finite values', () => {
    expect(
      clampPacingParams({ ...DEFAULT_PACING_PARAMS, streakTarget: NaN, eguchiDays: Infinity }),
    ).toEqual(DEFAULT_PACING_PARAMS)
  })
})
