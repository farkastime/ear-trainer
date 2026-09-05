import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chordById } from '../../core/content/chords'
import { activeProfile, useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { CONFIRM_SECONDS, FEEDBACK_MS, Session } from './Session'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
})
afterEach(() => vi.useRealTimers())

const current = () => useAppStore.getState().session!.currentChordId!
const tile = (id: string) => screen.getByTestId(`tile-${id}`)

describe('Session', () => {
  it('renders unlocked tiles in curriculum order and plays the question', () => {
    useAppStore.getState().parentUnlockNext()
    useAppStore.getState().startSession()
    const { services } = renderApp(<Session />)
    const tiles = screen.getAllByTestId(/^tile-(?!grid$)/)
    expect(tiles.map((t) => t.dataset.chord)).toEqual(['red', 'yellow', 'blue'])
    expect(tile('red')).toHaveStyle({ '--tile-color': '#e53935' })
    expect(screen.getByTestId('tile-grid').dataset.cols).toBe('2')
    act(() => vi.advanceTimersByTime(200))
    const player = services.player as unknown as { played: { notes: string[] }[] }
    expect(player.played[0].notes).toEqual(chordById(current()).notes)
  })

  it('a correct tap pops, replays the chord, then advances', () => {
    useAppStore.getState().startSession()
    const { services } = renderApp(<Session />)
    act(() => vi.advanceTimersByTime(200))
    const asked = current()
    fireEvent.click(tile(asked))
    expect(useAppStore.getState().session!.phase).toBe('feedback')
    expect(tile(asked).className).toMatch(/pop/)
    const player = services.player as unknown as { played: { notes: string[] }[] }
    expect(player.played).toHaveLength(2)
    act(() => vi.advanceTimersByTime(FEEDBACK_MS))
    expect(useAppStore.getState().session!.phase).toBe('question')
    expect(useAppStore.getState().session!.answers).toHaveLength(1)
  })

  it('a wrong tap shakes the tapped tile and pulses the right one', () => {
    useAppStore.getState().startSession()
    renderApp(<Session />)
    const asked = current()
    const wrong = asked === 'red' ? 'yellow' : 'red'
    fireEvent.click(tile(wrong))
    expect(tile(wrong).className).toMatch(/shake/)
    expect(tile(asked).className).toMatch(/pulse/)
    act(() => vi.advanceTimersByTime(FEEDBACK_MS + 500))
    expect(useAppStore.getState().session!.phase).toBe('question')
  })

  it('does not carry a shake target over to the next question', () => {
    useAppStore.getState().startSession()
    renderApp(<Session />)
    const firstAsked = current()
    const wrong = firstAsked === 'red' ? 'yellow' : 'red'
    fireEvent.click(tile(wrong))
    act(() => vi.advanceTimersByTime(FEEDBACK_MS + 500))
    const secondAsked = current()
    fireEvent.click(tile(secondAsked))
    expect(
      screen.getAllByTestId(/^tile-(?!grid$)/).some((t) => t.className.includes('shake')),
    ).toBe(false)
    expect(tile(secondAsked).className).toMatch(/pop/)
  })

  it('ignores taps during feedback and on a napping tile', () => {
    useAppStore.getState().parentUnlockNext()
    useAppStore.setState((s) => ({
      profiles: s.profiles.map((p) => ({
        ...p,
        progression: { ...p.progression, napping: 'blue' },
      })),
    }))
    useAppStore.getState().startSession()
    renderApp(<Session />)
    expect(tile('blue')).toBeDisabled()
    expect(tile('blue').className).toMatch(/napping/)
    fireEvent.click(tile('blue'))
    expect(useAppStore.getState().session!.answers).toHaveLength(0)
    fireEvent.click(tile(current()))
    fireEvent.click(tile(current()))
    expect(useAppStore.getState().session!.answers).toHaveLength(1)
  })

  it('waits for the confirmation replay to finish, plus a pause, before the next question', () => {
    useAppStore.getState().startSession()
    renderApp(<Session />)
    act(() => vi.advanceTimersByTime(200))
    fireEvent.click(tile(current()))
    expect(useAppStore.getState().session!.phase).toBe('feedback')
    act(() => vi.advanceTimersByTime(CONFIRM_SECONDS * 1000))
    expect(useAppStore.getState().session!.phase).toBe('feedback')
    act(() => vi.advanceTimersByTime(FEEDBACK_MS - CONFIRM_SECONDS * 1000))
    expect(useAppStore.getState().session!.phase).toBe('question')
    expect(FEEDBACK_MS).toBeGreaterThanOrEqual(CONFIRM_SECONDS * 1000 + 500)
  })

  it('shows a listening cue while the question chord plays, and not during feedback', () => {
    useAppStore.getState().startSession()
    renderApp(<Session />)
    expect(screen.getByTestId('listening')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(200))
    expect(screen.getByTestId('listening')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2600))
    expect(screen.queryByTestId('listening')).toBeNull()
    fireEvent.click(tile(current()))
    expect(screen.queryByTestId('listening')).toBeNull()
  })

  it('dims the tiles from a tap until the next question chord has finished', () => {
    useAppStore.getState().startSession()
    renderApp(<Session />)
    const dimmed = () =>
      screen.getAllByTestId(/^tile-(?!grid$)/).every((t) => t.className.includes('dim'))
    act(() => vi.advanceTimersByTime(200))
    expect(dimmed()).toBe(true) // the first chord is sounding
    act(() => vi.advanceTimersByTime(2600))
    expect(dimmed()).toBe(false)
    fireEvent.click(tile(current()))
    expect(dimmed()).toBe(true) // feedback
    act(() => vi.advanceTimersByTime(FEEDBACK_MS + 200))
    expect(dimmed()).toBe(true) // next chord sounding
    act(() => vi.advanceTimersByTime(2600))
    expect(dimmed()).toBe(false)
  })

  it('hear again replays, stop ends the session', () => {
    useAppStore.getState().startSession()
    const { services } = renderApp(<Session />)
    act(() => vi.advanceTimersByTime(200))
    fireEvent.click(screen.getByRole('button', { name: /hear it again/i }))
    expect((services.player as unknown as { played: unknown[] }).played).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /stop/i }))
    expect(useAppStore.getState().screen).toBe('summary')
  })

  it('shows the streak badge from 3 and the trail fills', () => {
    useAppStore.getState().updateSettings({ pacing: 'manual' })
    useAppStore.getState().startSession()
    renderApp(<Session />)
    expect(screen.queryByTestId('streak-badge')).toBeNull()
    for (let i = 0; i < 3; i++) {
      fireEvent.click(tile(current()))
      act(() => vi.advanceTimersByTime(FEEDBACK_MS))
    }
    expect(screen.getByTestId('streak-badge').textContent).toContain('3')
    expect(
      screen.getAllByTestId('trail-dot').filter((d) => d.className.includes('correct')),
    ).toHaveLength(3)
    expect(activeProfile(useAppStore.getState())!.progression.streak).toBe(3)
  })

  it('runs the primer, highlighting tiles in turn and blocking taps', () => {
    useAppStore.getState().parentUnlockNext()
    useAppStore.getState().startSession()
    useAppStore.setState({ pendingPrimer: ['red', 'yellow', 'blue'] })
    renderApp(<Session />)
    act(() => vi.advanceTimersByTime(0))
    expect(tile('red').className).toMatch(/highlight/)
    fireEvent.click(tile(current()))
    expect(useAppStore.getState().session!.answers).toHaveLength(0)
    act(() => vi.advanceTimersByTime(1200))
    expect(tile('yellow').className).toMatch(/highlight/)
    act(() => vi.advanceTimersByTime(1200))
    expect(tile('blue').className).toMatch(/highlight/)
    act(() => vi.advanceTimersByTime(2500))
    expect(useAppStore.getState().pendingPrimer).toBeNull()
  })
})
