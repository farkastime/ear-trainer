import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, clampSettings, newProfile } from './profile'

describe('newProfile', () => {
  it('starts at level 1 with default settings', () => {
    const p = newProfile('Ada', '🐱', 5000, 'id-1')
    expect(p).toMatchObject({ id: 'id-1', name: 'Ada', avatarEmoji: '🐱', createdAt: 5000 })
    expect(p.settings).toEqual(DEFAULT_SETTINGS)
    expect(p.progression.unlocks).toEqual([
      { chordId: 'red', unlockedAt: 5000 },
      { chordId: 'yellow', unlockedAt: 5000 },
    ])
    expect(p.progression.lastNapChangeAt).toBe(5000)
    expect(DEFAULT_SETTINGS).toMatchObject({
      pacing: 'unlimited',
      instrumentId: 'piano',
      sessionTarget: 20,
      showLetters: false,
      intensity: 'full',
    })
  })

  it('clamps session target and pacing params', () => {
    const s = clampSettings({
      ...DEFAULT_SETTINGS,
      sessionTarget: 200,
      pacingParams: { ...DEFAULT_SETTINGS.pacingParams, streakTarget: 0 },
    })
    expect(s.sessionTarget).toBe(50)
    expect(s.pacingParams.streakTarget).toBe(3)
    expect(clampSettings({ ...DEFAULT_SETTINGS, sessionTarget: 4 }).sessionTarget).toBe(10)
    expect(clampSettings({ ...DEFAULT_SETTINGS, sessionTarget: NaN }).sessionTarget).toBe(20)
  })
})
