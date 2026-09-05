import { useEffect, useRef, useState } from 'react'
import { randomDuration } from '../../audio/duration'
import { heatVars } from '../../celebrations/heat'
import { chordById } from '../../core/content/chords'
import { unlockedChordIds } from '../../core/content/curriculum'
import type { SessionState } from '../../core/engine/session'
import type { Profile } from '../../core/types'
import { activeProfile, useAppStore } from '../../state/store'
import { useAudio } from '../AudioContext'
import { ChordTile, type TileFlash } from '../components/ChordTile'
import { ProgressTrail } from '../components/ProgressTrail'
import { StreakBadge } from '../components/StreakBadge'
import { TileGrid } from '../components/TileGrid'
import { usePrimer } from '../hooks/usePrimer'

// A correct answer is confirmed visually only; a miss replays the chord while the
// right tile pulses, and its feedback must outlast that replay.
export const CONFIRM_SECONDS = 1.5
export const FEEDBACK_CORRECT_MS = 1500
export const FEEDBACK_WRONG_MS = CONFIRM_SECONDS * 1000 + 700
export const QUESTION_DELAY_MS = 500
const PRIMER_SECONDS = 1.2

export function Session() {
  const session = useAppStore((s) => s.session)
  const profile = useAppStore(activeProfile)
  if (!session || !profile) return null
  return <SessionView session={session} profile={profile} />
}

function SessionView({ session, profile }: { session: SessionState; profile: Profile }) {
  const pendingPrimer = useAppStore((s) => s.pendingPrimer)
  const answer = useAppStore((s) => s.answer)
  const advance = useAppStore((s) => s.advance)
  const endSession = useAppStore((s) => s.endSession)
  const clearPrimer = useAppStore((s) => s.clearPrimer)
  const { player } = useAudio()
  const [lastChosen, setLastChosen] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const primerReplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const play = (chordId: string, seconds: number) =>
    player.playChord([...chordById(chordId).notes], seconds)

  const { activeId: primerId } = usePrimer(pendingPrimer, {
    onStep: (id, last) => {
      play(id, PRIMER_SECONDS)
      if (primerReplayTimer.current) clearTimeout(primerReplayTimer.current)
      if (last) primerReplayTimer.current = setTimeout(() => play(id, PRIMER_SECONDS), 800)
    },
    onDone: clearPrimer,
  })

  useEffect(() => {
    return () => {
      if (primerReplayTimer.current) clearTimeout(primerReplayTimer.current)
    }
  }, [])

  useEffect(() => {
    if (session.phase === 'question') setLastChosen(null)
  }, [session.phase, session.answers.length])

  useEffect(() => {
    if (session.phase !== 'question' || !session.currentChordId || pendingPrimer) return
    const id = session.currentChordId
    // The cue starts with the question, not the chord, so there is no gap before playback.
    setListening(true)
    let done: ReturnType<typeof setTimeout> | undefined
    const t = setTimeout(() => {
      const seconds = randomDuration(Math.random)
      play(id, seconds)
      done = setTimeout(() => setListening(false), seconds * 1000)
    }, QUESTION_DELAY_MS)
    return () => {
      clearTimeout(t)
      if (done) clearTimeout(done)
      setListening(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase, session.currentChordId, session.answers.length, pendingPrimer])

  useEffect(() => {
    if (session.phase !== 'feedback') return
    const last = session.answers[session.answers.length - 1]
    if (!last.correct) play(last.chordId, CONFIRM_SECONDS)
    const t = setTimeout(advance, last.correct ? FEEDBACK_CORRECT_MS : FEEDBACK_WRONG_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase, session.answers.length])

  const { progression, settings } = profile
  const unlocked = unlockedChordIds(progression.unlocks)
  const last = session.answers[session.answers.length - 1]
  const inputLocked = session.phase !== 'question' || pendingPrimer !== null

  function flashFor(id: string): TileFlash {
    if (primerId === id) return 'highlight'
    if (session.phase !== 'feedback' || !last) return null
    if (last.correct) return id === last.chordId ? 'pop' : null
    if (id === lastChosen) return 'shake'
    if (id === last.chordId) return 'pulse'
    return null
  }

  function onTap(id: string) {
    if (inputLocked || id === progression.napping) return
    setLastChosen(id)
    answer(id)
  }

  return (
    <div
      className="screen session"
      data-screen="session"
      data-testid="screen-session"
      style={heatVars(progression.heat)}
    >
      <div className="row">
        <button className="icon-button" aria-label="Stop" onClick={endSession}>
          ✕
        </button>
        <div className="grow center">
          {listening && (
            <span className="listening" data-testid="listening" aria-label="Listen">
              👂
            </span>
          )}
        </div>
        <button
          className="icon-button"
          aria-label="Hear it again"
          disabled={inputLocked}
          onClick={() =>
            session.currentChordId && play(session.currentChordId, randomDuration(Math.random))
          }
        >
          🔊
        </button>
      </div>
      <StreakBadge streak={progression.streak} heat={progression.heat} />
      <ProgressTrail answers={session.answers} target={session.target} />
      <TileGrid count={unlocked.length}>
        {unlocked.map((id) => (
          <ChordTile
            key={id}
            chord={chordById(id)}
            showLetters={settings.showLetters}
            napping={progression.napping === id}
            flash={flashFor(id)}
            disabled={inputLocked}
            onTap={onTap}
          />
        ))}
      </TileGrid>
    </div>
  )
}
