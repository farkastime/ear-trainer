import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chordById } from '../../core/content/chords'
import { activeProfile, useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import {
  FEEDBACK_CORRECT_MS,
  FEEDBACK_WRONG_MS,
  LEVELUP_LEAD_MS,
  MILESTONE_POP_MS,
  QUESTION_DELAY_MS,
  Session,
} from './Session'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
})
afterEach(() => vi.useRealTimers())

const current = () => useAppStore.getState().session!.currentChordId!
const tile = (id: string) => screen.getByTestId(`tile-${id}`)
const other = () => (current() === 'red' ? 'yellow' : 'red')
// Past the question delay, so the question chord has been played.
const AFTER_QUESTION_MS = QUESTION_DELAY_MS + 100
// Longest question chord (2.5 s) plus the delay before it.
const CHORD_DONE_MS = QUESTION_DELAY_MS + 2600

describe('Session', () => {
  it('renders unlocked tiles in curriculum order and plays the question', () => {
    useAppStore.getState().parentUnlockNext()
    useAppStore.getState().startSession()
    const { services } = renderApp(<Session />)
    const tiles = screen.getAllByTestId(/^tile-(?!grid$)/)
    expect(tiles.map((t) => t.dataset.chord)).toEqual(['red', 'yellow', 'blue'])
    expect(tile('red')).toHaveStyle({ '--tile-color': '#e53935' })
    expect(screen.getByTestId('tile-grid').dataset.cols).toBe('2')
    act(() => vi.advanceTimersByTime(AFTER_QUESTION_MS))
    const player = services.player as unknown as { played: { notes: string[] }[] }
    expect(player.played[0].notes).toEqual(chordById(current()).notes)
  })

  it('a correct tap pops without a replay, then advances after the correct-feedback pause', () => {
    useAppStore.getState().startSession()
    const { services } = renderApp(<Session />)
    act(() => vi.advanceTimersByTime(AFTER_QUESTION_MS))
    const asked = current()
    fireEvent.click(tile(asked))
    expect(useAppStore.getState().session!.phase).toBe('feedback')
    expect(tile(asked).className).toMatch(/pop/)
    const player = services.player as unknown as { played: { notes: string[] }[] }
    expect(player.played).toHaveLength(1)
    act(() => vi.advanceTimersByTime(FEEDBACK_CORRECT_MS - 1))
    expect(useAppStore.getState().session!.phase).toBe('feedback')
    act(() => vi.advanceTimersByTime(1))
    expect(useAppStore.getState().session!.phase).toBe('question')
    expect(useAppStore.getState().session!.answers).toHaveLength(1)
  })

  it('a wrong tap shakes the tapped tile and pulses the right one, with no replay', () => {
    useAppStore.getState().startSession()
    const { services } = renderApp(<Session />)
    act(() => vi.advanceTimersByTime(AFTER_QUESTION_MS))
    const asked = current()
    const wrong = other()
    fireEvent.click(tile(wrong))
    expect(tile(wrong).className).toMatch(/shake/)
    expect(tile(asked).className).toMatch(/pulse/)
    const player = services.player as unknown as { played: { notes: string[] }[] }
    expect(player.played).toHaveLength(1)
    act(() => vi.advanceTimersByTime(FEEDBACK_WRONG_MS - 1))
    expect(useAppStore.getState().session!.phase).toBe('feedback')
    act(() => vi.advanceTimersByTime(1))
    expect(useAppStore.getState().session!.phase).toBe('question')
  })

  it('does not carry a shake target over to the next question', () => {
    useAppStore.getState().startSession()
    renderApp(<Session />)
    fireEvent.click(tile(other()))
    act(() => vi.advanceTimersByTime(FEEDBACK_WRONG_MS))
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

  it('throbs the hear-again button while the question chord plays', () => {
    useAppStore.getState().startSession()
    renderApp(<Session />)
    act(() => vi.advanceTimersByTime(AFTER_QUESTION_MS))
    expect(screen.getByTestId('hear-again').className).toMatch(/throb/)
    act(() => vi.advanceTimersByTime(CHORD_DONE_MS))
    expect(screen.getByTestId('hear-again').className).not.toMatch(/throb/)
    expect(screen.queryByTestId('listening')).toBeNull()
  })

  it('hear again replays, stop ends the session', () => {
    useAppStore.getState().startSession()
    const { services } = renderApp(<Session />)
    act(() => vi.advanceTimersByTime(AFTER_QUESTION_MS))
    fireEvent.click(screen.getByRole('button', { name: /hear it again/i }))
    expect((services.player as unknown as { played: unknown[] }).played).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /stop/i }))
    expect(useAppStore.getState().screen).toBe('summary')
  })

  it('warms the room from the first correct answer, with no streak counter', () => {
    useAppStore.getState().updateSettings({ pacing: 'manual' })
    useAppStore.getState().startSession()
    renderApp(<Session />)
    const glow = () => screen.getByTestId('screen-session').style.getPropertyValue('--heat-glow')
    expect(glow()).toBe('0px')
    fireEvent.click(tile(current()))
    act(() => vi.advanceTimersByTime(FEEDBACK_CORRECT_MS))
    const afterOne = parseInt(glow(), 10)
    expect(afterOne).toBeGreaterThan(0)
    for (let i = 0; i < 2; i++) {
      fireEvent.click(tile(current()))
      act(() => vi.advanceTimersByTime(FEEDBACK_CORRECT_MS))
    }
    expect(parseInt(glow(), 10)).toBeGreaterThan(afterOne)
    expect(screen.queryByTestId('streak-badge')).toBeNull()
    expect(screen.queryByText(/🔥/)).toBeNull()
    expect(
      screen.getAllByTestId('trail-dot').filter((d) => d.className.includes('correct')),
    ).toHaveLength(3)
    expect(activeProfile(useAppStore.getState())!.progression.streak).toBe(3)
  })

  it('throws up a big numeral at a streak milestone, then clears it', () => {
    useAppStore.getState().updateSettings({ pacing: 'manual' })
    useAppStore.getState().startSession()
    renderApp(<Session />)
    for (let i = 0; i < 4; i++) {
      fireEvent.click(tile(current()))
      act(() => vi.advanceTimersByTime(FEEDBACK_CORRECT_MS))
    }
    expect(screen.queryByTestId('milestone-pop')).toBeNull()
    fireEvent.click(tile(current()))
    expect(screen.getByTestId('milestone-pop').textContent).toBe('5')
    act(() => vi.advanceTimersByTime(MILESTONE_POP_MS + 10))
    expect(screen.queryByTestId('milestone-pop')).toBeNull()
  })

  it('flashes Overtime and keeps asking when the last trial is correct but not a level-up', () => {
    useAppStore.getState().updateSettings({
      sessionTarget: 10,
      pacingParams: { streakTarget: 50, eguchiWindow: 40, eguchiDays: 14, eguchiSessions: 10 },
    })
    useAppStore.getState().startSession()
    renderApp(<Session />)
    for (let i = 0; i < 10; i++) {
      fireEvent.click(tile(current()))
      act(() => vi.advanceTimersByTime(FEEDBACK_CORRECT_MS))
    }
    const session = useAppStore.getState().session!
    expect(session.phase).toBe('question')
    expect(session.overtime).toBe(true)
    expect(screen.getByTestId('milestone-pop').textContent).toBe('Overtime!')
    expect(screen.getByTestId('overtime-badge')).toBeInTheDocument()
  })

  it('moves to the level-up as soon as the milestone chime ends', () => {
    useAppStore.getState().updateSettings({
      pacingParams: { streakTarget: 3, eguchiWindow: 40, eguchiDays: 14, eguchiSessions: 10 },
    })
    useAppStore.getState().startSession()
    renderApp(<Session />)
    for (let i = 0; i < 2; i++) {
      fireEvent.click(tile(current()))
      act(() => vi.advanceTimersByTime(FEEDBACK_CORRECT_MS))
    }
    fireEvent.click(tile(current()))
    expect(useAppStore.getState().session!.pendingLevelUp).toBe('blue')
    act(() => vi.advanceTimersByTime(LEVELUP_LEAD_MS))
    expect(useAppStore.getState().session!.phase).toBe('levelUp')
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
