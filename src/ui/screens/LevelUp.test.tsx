import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNullPlayer } from '../../audio/player'
import { createNullSfx } from '../../audio/sfx'
import { useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { LevelUp } from './LevelUp'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
  useAppStore.getState().updateSettings({
    pacingParams: { streakTarget: 3, eguchiWindow: 40, eguchiDays: 14, eguchiSessions: 10 },
  })
  useAppStore.getState().startSession()
  let guard = 0
  while (useAppStore.getState().session?.phase !== 'levelUp' && guard++ < 30) {
    useAppStore.getState().answer(useAppStore.getState().session!.currentChordId!)
    useAppStore.getState().advance()
  }
})
afterEach(() => vi.useRealTimers())

describe('LevelUp', () => {
  it('reveals the new character, plays its chord three times, and continues without a primer', async () => {
    expect(useAppStore.getState().session?.phase).toBe('levelUp')
    const player = createNullPlayer()
    const sfx = createNullSfx()
    renderApp(<LevelUp />, { player, sfx })
    expect(screen.getByText(/meet whale/i)).toBeInTheDocument()
    expect(sfx.calls).toContain('fanfare')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500)
    })
    expect(player.played).toHaveLength(3)
    fireEvent.click(screen.getByText('🐳'))
    expect(player.played).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(useAppStore.getState().session?.phase).toBe('question')
    expect(useAppStore.getState().pendingPrimer).toBeNull()
  })

  it('loads the new chord samples for the profile instrument before playing', async () => {
    const player = createNullPlayer()
    const sfx = createNullSfx()
    renderApp(<LevelUp />, { player, sfx })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(player.loaded).toContain('piano')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500)
    })
    expect(player.played).toHaveLength(3)
  })
})
