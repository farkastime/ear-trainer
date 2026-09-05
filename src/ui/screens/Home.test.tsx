import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { chordById } from '../../core/content/chords'
import { activeProfile, useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { Home } from './Home'

beforeEach(() => {
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
})

const tiles = () => screen.getAllByTestId(/^tile-(?!grid$)/)

describe('Home', () => {
  it('greets, shows a practice grid of the unlocked chords and stars, and starts get-ready on Play', () => {
    useAppStore.setState((s) => ({
      profiles: s.profiles.map((p) => ({ ...p, progression: { ...p.progression, stars: 7 } })),
    }))
    renderApp(<Home />)
    expect(screen.getByText(/hi, ada/i)).toBeInTheDocument()
    expect(screen.getByText(/practice!/i)).toBeInTheDocument()
    expect(tiles().map((t) => t.dataset.chord)).toEqual(['red', 'yellow'])
    expect(screen.getByText('🦁')).toBeInTheDocument()
    expect(screen.queryByText('🐳')).toBeNull()
    expect(screen.getByText(/7/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play/i }))
    expect(useAppStore.getState().screen).toBe('getReady')
  })

  it('tapping a practice tile unlocks audio, loads the instrument and plays the chord', async () => {
    const { services } = renderApp(<Home />)
    const player = services.player as unknown as {
      unlocked: boolean
      loaded: string[]
      played: { notes: string[] }[]
    }
    fireEvent.click(screen.getByTestId('tile-red'))
    await waitFor(() => expect(player.played).toHaveLength(1))
    expect(player.unlocked).toBe(true)
    expect(player.loaded).toEqual(['piano'])
    expect(player.played[0].notes).toEqual(chordById('red').notes)
    expect(screen.getByTestId('tile-red').className).toMatch(/pop/)
  })

  it('All chords shows every chord, locked ones as colour only, and remembers the choice', () => {
    renderApp(<Home />)
    fireEvent.click(screen.getByRole('button', { name: /all chords/i }))
    expect(tiles()).toHaveLength(14)
    const blue = screen.getByTestId('tile-blue')
    expect(blue.className).toMatch(/locked/)
    expect(blue.textContent).toBe('')
    expect(blue).toHaveAccessibleName('Locked chord')
    expect(screen.getByTestId('tile-red').textContent).toBe('🦁')
    expect(activeProfile(useAppStore.getState())!.settings.practiceAll).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /my chords/i }))
    expect(tiles()).toHaveLength(2)
  })

  it('marks a napping tile and shows the manual-unlock badge', () => {
    useAppStore.getState().parentUnlockNext()
    useAppStore.setState((s) => ({
      profiles: s.profiles.map((p) => ({
        ...p,
        settings: { ...p.settings, pacing: 'manual' },
        progression: { ...p.progression, napping: 'blue', readyForUnlock: true },
      })),
    }))
    renderApp(<Home />)
    expect(screen.getByTestId('tile-blue').className).toMatch(/napping/)
    expect(screen.getByText(/ready for a new friend/i)).toBeInTheDocument()
  })

  it('gear goes to parent screen and switch player goes to profiles', () => {
    renderApp(<Home />)
    fireEvent.click(screen.getByRole('button', { name: /grown-ups/i }))
    expect(useAppStore.getState().screen).toBe('parent')
    useAppStore.setState({ screen: 'home' })
    fireEvent.click(screen.getByRole('button', { name: /switch profile/i }))
    expect(useAppStore.getState().screen).toBe('profiles')
  })
})
