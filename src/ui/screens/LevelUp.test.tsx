import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNullPlayer } from '../../audio/player'
import { createNullSfx } from '../../audio/sfx'
import { useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { FIRST_PLAY_DELAY_MS, LevelUp, PLAY_GAP_MS, UNLOCK_ANIM_MS } from './LevelUp'

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

const flush = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('LevelUp', () => {
  it('shakes a locked tile, reveals the character, then plays its chord three times', async () => {
    expect(useAppStore.getState().session?.phase).toBe('levelUp')
    const player = createNullPlayer()
    const sfx = createNullSfx()
    renderApp(<LevelUp />, { player, sfx })
    expect(sfx.calls).toEqual(['fanfare', 'jingleLevelUp'])
    const tile = screen.getByTestId('reveal-tile')
    expect(tile.textContent).toBe('🔒')
    expect(tile.className).toMatch(/unlocking/)
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()

    await flush(UNLOCK_ANIM_MS + 10)
    expect(tile.textContent).toBe('🐳')
    expect(tile.className).not.toMatch(/unlocking/)
    expect(screen.getByText(/meet whale/i)).toBeInTheDocument()
    expect(player.played).toHaveLength(0)

    await flush(FIRST_PLAY_DELAY_MS)
    expect(player.played).toHaveLength(1)
    await flush(PLAY_GAP_MS * 2)
    expect(player.played).toHaveLength(3)
    await flush(3000)
    expect(player.played).toHaveLength(3)
    fireEvent.click(tile)
    expect(player.played).toHaveLength(4)

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(useAppStore.getState().session).toBeNull()
    expect(useAppStore.getState().screen).toBe('getReady')
    expect(useAppStore.getState().pendingPrimer).toBeNull()
  })

  it('loads the new chord samples for the profile instrument up front', async () => {
    const player = createNullPlayer()
    renderApp(<LevelUp />, { player })
    await flush(0)
    expect(player.loaded).toContain('piano')
  })
})
