import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNullPlayer } from '../../audio/player'
import { chordById } from '../../core/content/chords'
import { useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { GetReady, RUN_STEP_MS, UNLOCK_WAIT_MS } from './GetReady'

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
// Enough for a two-chord run-through: two steps plus the longer hold on the last.
const RUN_DONE_MS = RUN_STEP_MS + RUN_STEP_MS * 1.6 + 20
// Loading resolves in one act; the run-through's first timer is armed by an effect
// React commits at the end of that act, so it needs a second flush to fire.
const settle = async () => {
  await flush(10)
  await flush(10)
}
const tile = (id: string) => screen.getByTestId(`tile-${id}`)

describe('GetReady', () => {
  it('shows the tiles, loads, runs through each chord with a highlight, then starts the session', async () => {
    const player = createNullPlayer()
    renderApp(<GetReady />, { player })
    expect(screen.getByText(/get ready/i)).toBeInTheDocument()
    expect(screen.getByText(/here they come/i)).toBeInTheDocument()
    expect(tile('red')).toBeInTheDocument()
    expect(tile('yellow')).toBeInTheDocument()
    await settle()
    expect(player.unlocked).toBe(true)
    expect(player.loaded).toEqual(['piano'])
    expect(tile('red').className).toMatch(/highlight/)
    expect(player.played[0].notes).toEqual(chordById('red').notes)
    expect(useAppStore.getState().session).toBeNull()
    await flush(RUN_STEP_MS)
    expect(tile('yellow').className).toMatch(/highlight/)
    expect(player.played).toHaveLength(2)
    await flush(RUN_STEP_MS * 1.6 + 20)
    expect(useAppStore.getState().session?.phase).toBe('question')
    expect(useAppStore.getState().screen).toBe('session')
  })

  it('Skip starts the session at once', async () => {
    const player = createNullPlayer()
    renderApp(<GetReady />, { player })
    await flush(10)
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))
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
    await settle()
    await flush(RUN_DONE_MS)
    expect(useAppStore.getState().session?.phase).toBe('question')
    expect(useAppStore.getState().screen).toBe('session')
  })

  it('resumes an unfinished session instead of starting over', async () => {
    useAppStore.getState().startSession()
    const before = useAppStore.getState().session
    useAppStore.setState({ screen: 'getReady' })
    renderApp(<GetReady />, { player: createNullPlayer() })
    await settle()
    await flush(RUN_DONE_MS)
    expect(useAppStore.getState().session).toBe(before)
    expect(useAppStore.getState().screen).toBe('session')
  })

  it('falls back to piano when the chosen instrument fails, and offers retry when everything fails', async () => {
    useAppStore.getState().updateSettings({ instrumentId: 'organ' })
    const player = createNullPlayer()
    player.failLoads = 3
    const first = renderApp(<GetReady />, { player })
    await flush(3000)
    await settle()
    await flush(RUN_DONE_MS)
    expect(player.loaded).toEqual(['organ', 'organ', 'organ', 'piano'])
    expect(useAppStore.getState().audioFallback).toEqual({ requested: 'organ', used: 'piano' })
    expect(useAppStore.getState().screen).toBe('session')
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
