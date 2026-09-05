import { useEffect, useRef, useState } from 'react'
import { loadWithFallback } from '../../audio/loading'
import { chordById } from '../../core/content/chords'
import { DEFAULT_CURRICULUM, isChampion, unlockedChordIds } from '../../core/content/curriculum'
import { DEFAULT_INSTRUMENT_ID, instrumentById } from '../../core/content/instruments'
import { activeProfile, useAppStore } from '../../state/store'
import { useAudio } from '../AudioContext'
import { ChordTile } from '../components/ChordTile'
import { TileGrid } from '../components/TileGrid'

const PRACTICE_SECONDS = 1.5
const FLASH_MS = 500

export function Home() {
  const profile = useAppStore(activeProfile)
  const goTo = useAppStore((s) => s.goTo)
  const selectProfile = useAppStore((s) => s.selectProfile)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const { player } = useAudio()
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    },
    [],
  )
  if (!profile) return null
  const { progression, settings } = profile
  const showReady = settings.pacing === 'manual' && progression.readyForUnlock
  const unlocked = unlockedChordIds(progression.unlocks)
  const shown = settings.practiceAll ? [...DEFAULT_CURRICULUM] : unlocked

  // Practice taps are the user gesture that unlocks audio; samples load on demand.
  async function practice(id: string) {
    const notes = [...chordById(id).notes]
    setFlash(id)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS)
    try {
      await player.unlock()
      await loadWithFallback(
        player,
        instrumentById(settings.instrumentId),
        notes,
        instrumentById(DEFAULT_INSTRUMENT_ID),
      )
      player.playChord(notes, PRACTICE_SECONDS)
    } catch {
      // Silent: the get-ready screen reports audio failures with a retry.
    }
  }

  return (
    <div className="screen" data-screen="home" data-testid="screen-home">
      <div className="row">
        <button
          className="icon-button"
          aria-label="Switch profile"
          onClick={() => selectProfile(null)}
        >
          {profile.avatarEmoji}
        </button>
        <h1 className="screen-title grow">Hi, {profile.name}!</h1>
        <button className="icon-button" aria-label="About EarBuddies" onClick={() => goTo('about')}>
          ℹ️
        </button>
        <button className="icon-button" aria-label="Grown-ups" onClick={() => goTo('parent')}>
          ⚙️
        </button>
      </div>

      <p className="stars center">⭐ {progression.stars}</p>
      {isChampion(progression) && (
        <p className="center">
          <span className="badge">🏆 Grand Champion</span>
        </p>
      )}
      {showReady && (
        <p className="center">
          <span className="badge">Ready for a new friend! Ask a grown-up.</span>
        </p>
      )}

      <h2 className="screen-title" style={{ margin: 0 }}>
        Practice!
      </h2>
      <div className="segmented" role="group" aria-label="Which chords to practice">
        <button
          aria-pressed={!settings.practiceAll}
          onClick={() => updateSettings({ practiceAll: false })}
        >
          My chords
        </button>
        <button
          aria-pressed={settings.practiceAll}
          onClick={() => updateSettings({ practiceAll: true })}
        >
          All chords
        </button>
      </div>
      <TileGrid count={shown.length}>
        {shown.map((id) => (
          <ChordTile
            key={id}
            chord={chordById(id)}
            showLetters={settings.showLetters}
            napping={progression.napping === id}
            locked={!unlocked.includes(id)}
            flash={flash === id ? 'pop' : null}
            disabled={false}
            onTap={practice}
          />
        ))}
      </TileGrid>

      <button className="big-button" onClick={() => goTo('getReady')}>
        ▶ Play
      </button>
    </div>
  )
}
