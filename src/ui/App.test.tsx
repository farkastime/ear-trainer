import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../state/store'
import { App } from './App'
import { renderApp, resetStore } from './testing'

beforeEach(() => {
  // jsdom logs "not implemented" for canvas 2d contexts; CelebrationLayer guards on a null ctx.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  resetStore()
})
afterEach(() => vi.restoreAllMocks())

describe('App', () => {
  it('shows the profile picker when there are no profiles and creates one', () => {
    renderApp(<App />)
    expect(screen.getByTestId('screen-profiles')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByRole('button', { name: '🐱' }))
    fireEvent.click(screen.getByRole('button', { name: /let's go/i }))
    expect(useAppStore.getState().profiles[0]).toMatchObject({ name: 'Ada', avatarEmoji: '🐱' })
    expect(screen.getByTestId('screen-home')).toBeInTheDocument()
  })

  it('returns to home for a remembered active profile', () => {
    useAppStore.getState().createProfile('Ada', '🐱')
    useAppStore.setState({ screen: 'profiles' })
    renderApp(<App />)
    expect(screen.getByTestId('screen-home')).toBeInTheDocument()
  })

  it('resumes an unfinished session through get-ready', () => {
    useAppStore.getState().createProfile('Ada', '🐱')
    useAppStore.getState().startSession()
    useAppStore.setState({ screen: 'profiles' })
    renderApp(<App />)
    expect(screen.getByTestId('screen-getReady')).toBeInTheDocument()
  })

  it('shows and dismisses a storage notice', () => {
    useAppStore.setState({ storageNotice: 'corrupt' })
    renderApp(<App />)
    expect(screen.getByText(/could not be read/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ok/i }))
    expect(screen.queryByText(/could not be read/i)).toBeNull()
  })
})
