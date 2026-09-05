import { useEffect } from 'react'
import { chordById } from '../../core/content/chords'
import { newestUnlockedId } from '../../core/content/curriculum'
import { activeProfile, useAppStore } from '../../state/store'
import { useAudio } from '../AudioContext'

const PLAYS = [0, 1500, 3000]
const REVEAL_SECONDS = 1.4

export function LevelUp() {
  const profile = useAppStore(activeProfile)
  const continueAfterLevelUp = useAppStore((s) => s.continueAfterLevelUp)
  const { player, sfx } = useAudio()
  const chord = profile ? chordById(newestUnlockedId(profile.progression.unlocks)) : null

  useEffect(() => {
    if (!chord || !profile) return
    if (profile.settings.celebrationSound) sfx.fanfare()
    const timers = PLAYS.map((ms) =>
      setTimeout(() => player.playChord([...chord.notes], REVEAL_SECONDS), ms),
    )
    return () => timers.forEach(clearTimeout)
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
