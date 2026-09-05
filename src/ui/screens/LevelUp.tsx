import { useEffect, useState, type CSSProperties } from 'react'
import { loadWithFallback } from '../../audio/loading'
import { chordById, chordRoot } from '../../core/content/chords'
import { newestUnlockedId } from '../../core/content/curriculum'
import { DEFAULT_INSTRUMENT_ID, instrumentById } from '../../core/content/instruments'
import { activeProfile, useAppStore } from '../../state/store'
import { useAudio } from '../AudioContext'

const REVEAL_SECONDS = 1.4
/** Two seconds of shaking, then the screen flashes; the character appears at peak white. Matches the CSS unlock timing. */
export const UNLOCK_ANIM_MS = 2200

export function LevelUp() {
  const profile = useAppStore(activeProfile)
  const continueAfterLevelUp = useAppStore((s) => s.continueAfterLevelUp)
  const { player, sfx } = useAudio()
  const session = useAppStore((s) => s.session)
  const chord = profile ? chordById(newestUnlockedId(profile.progression.unlocks)) : null
  // The jingle is in the key of the chord whose correct answer earned the unlock.
  const earnedBy = session?.answers[session.answers.length - 1]?.chordId
  const key = chordRoot(chordById(earnedBy ?? chord?.id ?? 'red'))
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (!chord || !profile) return
    if (profile.settings.celebrationSound) {
      sfx.fanfare()
      sfx.jingleLevelUp(key)
    }
    // Load the new chord's samples now so the first tap plays with the right timbre;
    // nothing plays automatically, the child taps the character to hear it.
    const instrument = instrumentById(profile.settings.instrumentId)
    loadWithFallback(
      player,
      instrument,
      [...chord.notes],
      instrumentById(DEFAULT_INSTRUMENT_ID),
    ).catch(() => {})
    setRevealed(false)
    const t = setTimeout(() => setRevealed(true), UNLOCK_ANIM_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chord?.id])

  if (!chord) return null
  return (
    <div className="overlay" data-testid="level-up" role="dialog" aria-label="New friend">
      <div className="screen-flash" aria-hidden="true" />
      <p style={{ fontSize: '1.4rem', margin: 0 }}>New friend!</p>
      <h1 style={{ margin: 0, fontSize: '2.4rem', minHeight: '1.2em' }}>
        {revealed ? `Meet ${chord.character.name}!` : '…'}
      </h1>
      {/* The character sits in its real tile so it reads as "tap me", like in the session. */}
      <button
        className={`tile ${revealed ? 'reveal' : 'reveal unlocking'}`}
        data-testid="reveal-tile"
        aria-label={revealed ? `Hear ${chord.character.name}` : 'Unlocking'}
        style={
          { '--tile-color': chord.color, boxShadow: `0 0 60px ${chord.color}` } as CSSProperties
        }
        disabled={!revealed}
        onClick={() => player.playChord([...chord.notes], REVEAL_SECONDS)}
      >
        <span>{revealed ? chord.character.emoji : '🔒'}</span>
      </button>
      <p className="muted" style={{ margin: 0, minHeight: '1.5em' }}>
        {revealed ? 'Tap to hear it' : ''}
      </p>
      <button className="big-button" onClick={continueAfterLevelUp} disabled={!revealed}>
        Continue
      </button>
    </div>
  )
}
