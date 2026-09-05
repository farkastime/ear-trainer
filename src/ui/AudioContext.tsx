import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { AudioPlayer } from '../audio/player'
import { createToneSfx, type Sfx } from '../audio/sfx'
import { createTonePlayer } from '../audio/tonePlayer'

export interface AudioServices {
  player: AudioPlayer
  sfx: Sfx
}

const Ctx = createContext<AudioServices | null>(null)

export function AudioProvider({
  services,
  children,
}: {
  services?: AudioServices
  children: ReactNode
}) {
  const value = useMemo<AudioServices>(
    () => services ?? { player: createTonePlayer(), sfx: createToneSfx() },
    [services],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAudio(): AudioServices {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAudio outside AudioProvider')
  return v
}
