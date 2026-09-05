import { describe, expect, it } from 'vitest'
import type { Progression, SessionSummary } from '../types'
import { shouldNap, shouldWake } from './nap'

const s = (endedAt: number, correct: number, countsForPacing = true): SessionSummary => ({
  startedAt: endedAt - 1,
  endedAt,
  count: 20,
  correct,
  levelAtStart: 2,
  stars: 1,
  leveledUp: false,
  countsForPacing,
})

function p(sessions: SessionSummary[], over: Partial<Progression> = {}): Progression {
  return {
    unlocks: ['red', 'yellow', 'blue'].map((chordId) => ({ chordId, unlockedAt: 0 })),
    napping: null,
    lastNapChangeAt: 0,
    streak: 0,
    bestStreak: 0,
    heat: 0,
    chordStats: {},
    recentAnswers: [],
    sessions,
    stars: 0,
    readyForUnlock: false,
    ...over,
  }
}

describe('shouldNap', () => {
  it('naps after two consecutive counted sessions under 70%', () => {
    expect(shouldNap(p([s(1, 13), s(2, 12)]))).toBe(true)
  })
  it('does not nap when the latest session is fine', () => {
    expect(shouldNap(p([s(1, 10), s(2, 19)]))).toBe(false)
  })
  it('exactly 70% is not under', () => {
    expect(shouldNap(p([s(1, 14), s(2, 14)]))).toBe(false)
  })
  it('ignores sessions that do not count and sessions before lastNapChangeAt', () => {
    expect(shouldNap(p([s(1, 5), s(2, 5, false)]))).toBe(false)
    expect(shouldNap(p([s(1, 5), s(2, 5)], { lastNapChangeAt: 1 }))).toBe(false)
  })
  it('never naps when only two chords are unlocked or one is already napping', () => {
    const two = p([s(1, 5), s(2, 5)], {
      unlocks: [
        { chordId: 'red', unlockedAt: 0 },
        { chordId: 'yellow', unlockedAt: 0 },
      ],
    })
    expect(shouldNap(two)).toBe(false)
    expect(shouldNap(p([s(1, 5), s(2, 5)], { napping: 'blue' }))).toBe(false)
  })
})

describe('shouldWake', () => {
  it('wakes a napping chord at an in-session streak of 5', () => {
    expect(shouldWake(p([], { napping: 'blue' }), 5)).toBe(true)
    expect(shouldWake(p([], { napping: 'blue' }), 4)).toBe(false)
    expect(shouldWake(p([]), 50)).toBe(false)
  })
})
