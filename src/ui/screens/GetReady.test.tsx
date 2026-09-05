import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNullPlayer } from '../../audio/player'
import { useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { GetReady, LISTEN_MS, MIN_RITUAL_MS, UNLOCK_WAIT_MS } from './GetReady'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
  useAppStore.setState({ screen: 'getReady' })
})
afterEach(() => vi.useRealTimers())

const flush = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('GetReady', () => {
  it('unlocks audio, loads the instrument, parades, cues Listen, then starts the session', async () => {
    const player = createNullPlayer()
    renderApp(<GetReady />, { player })
    expect(screen.getByTestId('screen-getReady')).toBeInTheDocument()
    expect(screen.getByText('🦁')).toBeInTheDocument()
    await flush(0)
    expect(player.unlocked).toBe(true)
    expect(player.loaded).toEqual(['piano'])
    expect(useAppStore.getState().session).toBeNull()
    await flush(MIN_RITUAL_MS)
    expect(screen.getByLabelText('Get Ready!')).toBeInTheDocument()
    expect(screen.getByText('Get')).toBeInTheDocument()
    expect(screen.getByText('Ready!')).toBeInTheDocument()
    await flush(LISTEN_MS)
    expect(useAppStore.getState().session?.phase).toBe('question')
    expect(useAppStore.getState().screen).toBe('session')
  })

  it('asks for a tap when the browser will not start audio without a gesture', async () => {
    const player = createNullPlayer()
    let unlockCalls = 0
    let releaseUnlock: () => void = () => {}
    player.unlock = () =>
      new Promise<void>((resolve) => {
        unlockCalls++
        releaseUnlock = resolve
      })
    renderApp(<GetReady />, { player })
    await flush(UNLOCK_WAIT_MS + 10)
    expect(screen.getByRole('button', { name: /tap to start/i })).toBeInTheDocument()
    expect(player.loaded).toEqual(['piano'])
    expect(useAppStore.getState().session).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /tap to start/i }))
    expect(unlockCalls).toBe(2)
    releaseUnlock()
    await flush(MIN_RITUAL_MS + LISTEN_MS + 10)
    expect(useAppStore.getState().session?.phase).toBe('question')
    expect(useAppStore.getState().screen).toBe('session')
  })

  it('resumes an unfinished session instead of starting over', async () => {
    useAppStore.getState().startSession()
    const before = useAppStore.getState().session
    useAppStore.setState({ screen: 'getReady' })
    renderApp(<GetReady />, { player: createNullPlayer() })
    await flush(MIN_RITUAL_MS + LISTEN_MS + 10)
    expect(useAppStore.getState().session).toBe(before)
    expect(useAppStore.getState().screen).toBe('session')
  })

  it('falls back to piano when the chosen instrument fails, and offers retry when everything fails', async () => {
    useAppStore.getState().updateSettings({ instrumentId: 'organ' })
    const player = createNullPlayer()
    player.failLoads = 3
    const first = renderApp(<GetReady />, { player })
    await flush(MIN_RITUAL_MS + LISTEN_MS + 3000)
    expect(player.loaded).toEqual(['organ', 'organ', 'organ', 'piano'])
    expect(useAppStore.getState().screen).toBe('session')
    expect(useAppStore.getState().audioFallback).toEqual({ requested: 'organ', used: 'piano' })
    first.unmount()

    resetStore()
    useAppStore.getState().createProfile('Bo', '🐶')
    useAppStore.setState({ screen: 'getReady' })
    const dead = createNullPlayer()
    dead.failLoads = 99
    renderApp(<GetReady />, { player: dead })
    await flush(10000)
    expect(screen.getByText(/can't load the sounds/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
