import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createNullPlayer } from '../audio/player'
import { createNullSfx } from '../audio/sfx'
import { EMPTY_SLICE } from '../state/migrations'
import { useAppStore } from '../state/store'
import { AudioProvider, type AudioServices } from './AudioContext'

export function resetStore(): void {
  window.localStorage.clear()
  useAppStore.setState({
    ...EMPTY_SLICE,
    screen: 'profiles',
    pendingPrimer: null,
    storageNotice: null,
  })
}

export function renderApp(ui: ReactNode, services: Partial<AudioServices> = {}) {
  const full: AudioServices = {
    player: services.player ?? createNullPlayer(),
    sfx: services.sfx ?? createNullSfx(),
  }
  return { ...render(<AudioProvider services={full}>{ui}</AudioProvider>), services: full }
}
