import { useEffect } from 'react'
import { loadWithFallback } from '../../audio/loading'
import { chordById } from '../../core/content/chords'
import { newestUnlockedId } from '../../core/content/curriculum'
import { DEFAULT_INSTRUMENT_ID, instrumentById } from '../../core/content/instruments'
import { activeProfile, useAppStore } from '../../state/store'
import { useAudio } from '../AudioContext'

// Three plays that overlap slightly, so the reveal feels like one gesture.
const PLAYS = [0, 1100, 2200]
const REVEAL_SECONDS = 1.4

export function LevelUp() {
  const profile = useAppStore(activeProfile)
  const continueAfterLevelUp = useAppStore((s) => s.continueAfterLevelUp)
  const { player, sfx } = useAudio()
  const chord = profile ? chordById(newestUnlockedId(profile.progression.unlocks)) : null

  useEffect(() => {
    if (!chord || !profile) return
    if (profile.settings.celebrationSound) sfx.fanfare()
    let cancelled = false
    let timers: ReturnType<typeof setTimeout>[] = []
    const schedulePlays = () => {
      if (cancelled) return
      timers = PLAYS.map((ms) =>
        setTimeout(() => player.playChord([...chord.notes], REVEAL_SECONDS), ms),
      )
    }
    const instrument = instrumentById(profile.settings.instrumentId)
    // The Sampler pitch-shifts from the nearest loaded sample, so a failed
    // load still produces audible (if less accurate) playback.
    loadWithFallback(player, instrument, [...chord.notes], instrumentById(DEFAULT_INSTRUMENT_ID))
      .catch(() => {})
      .then(schedulePlays)
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chord?.id])

  if (!chord) return null
  return (
    <div className="overlay" data-testid="level-up" role="dialog" aria-label="New friend">
      <p style={{ fontSize: '1.4rem', margin: 0 }}>New friend!</p>
      <h1 style={{ margin: 0, fontSize: '2.4rem' }}>Meet {chord.character.name}!</h1>
      <div
        className="reveal"
        style={{ textShadow: `0 0 40px ${chord.color}` }}
        onClick={() => player.playChord([...chord.notes], REVEAL_SECONDS)}
      >
        {chord.character.emoji}
      </div>
      <button className="big-button" onClick={continueAfterLevelUp}>
        Continue
      </button>
    </div>
  )
}
