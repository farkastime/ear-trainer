import { describe, expect, it } from 'vitest'
import type { Progression } from '../types'
import {
  DEFAULT_CURRICULUM,
  MAX_LEVEL,
  awakeChordIds,
  initialUnlocks,
  isChampion,
  levelOf,
  newestUnlockedId,
  nextChordId,
  unlockedChordIds,
} from './curriculum'

function progressionWith(ids: string[], napping: string | null = null): Progression {
  return {
    unlocks: ids.map((chordId, i) => ({ chordId, unlockedAt: i })),
    napping,
    lastNapChangeAt: 0,
    streak: 0,
    bestStreak: 0,
    heat: 0,
    chordStats: {},
    recentAnswers: [],
    sessions: [],
    stars: 0,
    readyForUnlock: false,
  }
}

describe('curriculum', () => {
  it('starts at level 1 with red and yellow', () => {
    const unlocks = initialUnlocks(1000)
    expect(unlocks).toEqual([
      { chordId: 'red', unlockedAt: 1000 },
      { chordId: 'yellow', unlockedAt: 1000 },
    ])
    expect(levelOf(unlocks)).toBe(1)
  })

  it('derives level from unlock count and caps at MAX_LEVEL', () => {
    expect(MAX_LEVEL).toBe(13)
    const all = progressionWith([...DEFAULT_CURRICULUM])
    expect(levelOf(all.unlocks)).toBe(13)
    expect(isChampion(all)).toBe(true)
    expect(nextChordId(all.unlocks)).toBeNull()
  })

  it('names the next chord in curriculum order', () => {
    expect(nextChordId(initialUnlocks(0))).toBe('blue')
    expect(newestUnlockedId(initialUnlocks(0))).toBe('yellow')
  })

  it('excludes the napping chord from the awake set', () => {
    const p = progressionWith(['red', 'yellow', 'blue', 'black'], 'black')
    expect(unlockedChordIds(p.unlocks)).toEqual(['red', 'yellow', 'blue', 'black'])
    expect(awakeChordIds(p)).toEqual(['red', 'yellow', 'blue'])
    expect(isChampion(p)).toBe(false)
  })
})
