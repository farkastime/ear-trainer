import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { Home } from './Home'

beforeEach(() => {
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
})

describe('Home', () => {
  it('greets, shows unlocked characters and stars, and starts get-ready on Play', () => {
    useAppStore.setState((s) => ({
      profiles: s.profiles.map((p) => ({ ...p, progression: { ...p.progression, stars: 7 } })),
    }))
    renderApp(<Home />)
    expect(screen.getByText(/hi, ada/i)).toBeInTheDocument()
    expect(screen.getByText('🦁')).toBeInTheDocument()
    expect(screen.getByText('🐥')).toBeInTheDocument()
    expect(screen.queryByText('🐳')).toBeNull()
    expect(screen.getByText(/7/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play/i }))
    expect(useAppStore.getState().screen).toBe('getReady')
  })

  it('marks a napping character and shows the manual-unlock badge', () => {
    useAppStore.getState().parentUnlockNext()
    useAppStore.setState((s) => ({
      profiles: s.profiles.map((p) => ({
        ...p,
        settings: { ...p.settings, pacing: 'manual' },
        progression: { ...p.progression, napping: 'blue', readyForUnlock: true },
      })),
    }))
    renderApp(<Home />)
    expect(screen.getByTitle(/whale is napping/i)).toBeInTheDocument()
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
