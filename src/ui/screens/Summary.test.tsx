import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../state/store'
import { renderApp, resetStore } from '../testing'
import { Summary } from './Summary'

beforeEach(() => {
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
  useAppStore.getState().updateSettings({ sessionTarget: 10, pacing: 'manual' })
  useAppStore.getState().startSession()
  for (let i = 0; i < 10; i++) {
    const s = useAppStore.getState().session!
    useAppStore
      .getState()
      .answer(i === 0 ? (s.currentChordId === 'red' ? 'yellow' : 'red') : s.currentChordId!)
    useAppStore.getState().advance()
  }
})

describe('Summary', () => {
  it('shows stars, score and cheering friends, and navigates', () => {
    expect(useAppStore.getState().screen).toBe('summary')
    renderApp(<Summary />)
    expect(screen.getByTestId('stars').textContent).toBe('⭐⭐')
    expect(screen.getByText(/9 of 10/)).toBeInTheDocument()
    expect(screen.getByText('🦁')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play again/i }))
    expect(useAppStore.getState().screen).toBe('getReady')
    useAppStore.setState({ screen: 'summary' })
    fireEvent.click(screen.getByRole('button', { name: /home/i }))
    expect(useAppStore.getState().screen).toBe('home')
  })
})
