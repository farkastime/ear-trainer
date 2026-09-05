import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activeProfile, useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { ParentSettings } from './ParentSettings'

function passGate() {
  const m = /(\d) × (\d)/.exec(screen.getByTestId('gate-question').textContent ?? '')!
  fireEvent.change(screen.getByLabelText(/answer/i), {
    target: { value: String(Number(m[1]) * Number(m[2])) },
  })
  fireEvent.click(screen.getByRole('button', { name: /go/i }))
}

beforeEach(() => {
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
  useAppStore.setState({ screen: 'parent' })
})

describe('ParentSettings', () => {
  it('is gated', () => {
    renderApp(<ParentSettings />)
    expect(screen.queryByText(/progression/i)).toBeNull()
    passGate()
    expect(screen.getByText(/progression/i)).toBeInTheDocument()
  })

  it('edits pacing, target and instrument', () => {
    renderApp(<ParentSettings />)
    passGate()
    fireEvent.click(screen.getByLabelText(/eguchi/i))
    fireEvent.change(screen.getByLabelText(/days between/i), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText(/questions per session/i), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText(/instrument/i), { target: { value: 'harp' } })
    const s = activeProfile(useAppStore.getState())!.settings
    expect(s.pacing).toBe('eguchi')
    expect(s.pacingParams.eguchiDays).toBe(7)
    expect(s.sessionTarget).toBe(30)
    expect(s.instrumentId).toBe('harp')
    fireEvent.change(screen.getByLabelText(/questions per session/i), { target: { value: '' } })
    expect(activeProfile(useAppStore.getState())!.settings.sessionTarget).toBe(30)
  })

  it('unlocks, wakes, rewinds and resets with confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp(<ParentSettings />)
    passGate()
    fireEvent.click(screen.getByRole('button', { name: /unlock next/i }))
    expect(activeProfile(useAppStore.getState())!.progression.unlocks).toHaveLength(3)
    act(() => {
      useAppStore.setState((st) => ({
        profiles: st.profiles.map((p) => ({
          ...p,
          progression: { ...p.progression, napping: 'blue' },
        })),
      }))
    })
    expect(screen.getByText(/whale is napping/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /wake now/i }))
    expect(activeProfile(useAppStore.getState())!.progression.napping).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /rewind a level/i }))
    expect(activeProfile(useAppStore.getState())!.progression.unlocks).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /reset progress/i }))
    expect(window.confirm).toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('shows per-chord stats and goes back home', () => {
    useAppStore.setState((st) => ({
      profiles: st.profiles.map((p) => ({
        ...p,
        progression: {
          ...p.progression,
          chordStats: { red: { attempts: 10, correct: 8 } },
          bestStreak: 6,
        },
      })),
    }))
    renderApp(<ParentSettings />)
    passGate()
    expect(screen.getByText(/lion/i)).toBeInTheDocument()
    expect(screen.getByText(/8 \/ 10/)).toBeInTheDocument()
    expect(screen.getByText(/best streak/i).textContent).toMatch(/6/)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(useAppStore.getState().screen).toBe('home')
  })

  it('discloses an instrument fallback', () => {
    act(() => {
      useAppStore.getState().setAudioFallback({ requested: 'organ', used: 'piano' })
    })
    renderApp(<ParentSettings />)
    passGate()
    expect(screen.getByText(/organ couldn't load; using piano/i)).toBeInTheDocument()
  })

  it('deletes the profile after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp(<ParentSettings />)
    passGate()
    fireEvent.click(screen.getByRole('button', { name: /delete profile/i }))
    expect(useAppStore.getState().profiles).toHaveLength(0)
    expect(useAppStore.getState().screen).toBe('profiles')
    vi.restoreAllMocks()
  })
})
