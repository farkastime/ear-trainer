import { useEffect, useRef, useState } from 'react'
import { randomDuration } from '../../audio/duration'
import { heatVars } from '../../celebrations/heat'
import { chordById } from '../../core/content/chords'
import { unlockedChordIds } from '../../core/content/curriculum'
import type { SessionState } from '../../core/engine/session'
import type { Profile } from '../../core/types'
import { onEngineEvent } from '../../state/eventBus'
import { activeProfile, useAppStore } from '../../state/store'
import { useAudio } from '../AudioContext'
import { ChordTile, type TileFlash } from '../components/ChordTile'
import { ProgressTrail } from '../components/ProgressTrail'
import { TileGrid } from '../components/TileGrid'
import { usePrimer } from '../hooks/usePrimer'

// Feedback is visual plus a short sound; the chord is never replayed.
export const FEEDBACK_CORRECT_MS = 1500
export const FEEDBACK_WRONG_MS = 1800
export const LEVELUP_LEAD_MS = 700
export const QUESTION_DELAY_MS = 500
export const MILESTONE_POP_MS = 2400
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
  const [milestone, setMilestone] = useState<number | null>(null)
  const primerReplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const milestoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A big numeral flies up with the milestone confetti, then is gone: a moment, not a counter.
  useEffect(() => {
    const off = onEngineEvent((e) => {
      if (e.type !== 'streakMilestone') return
      setMilestone(e.streak)
      if (milestoneTimer.current) clearTimeout(milestoneTimer.current)
      milestoneTimer.current = setTimeout(() => setMilestone(null), MILESTONE_POP_MS)
    })
    return () => {
      off()
      if (milestoneTimer.current) clearTimeout(milestoneTimer.current)
    }
  }, [])

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
    // A pending level-up moves on as soon as the milestone chime ends, so the jingle follows it.
    const wait = session.pendingLevelUp
      ? LEVELUP_LEAD_MS
      : last.correct
        ? FEEDBACK_CORRECT_MS
        : FEEDBACK_WRONG_MS
    const t = setTimeout(advance, wait)
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
      <button className="icon-button stop-button" aria-label="Stop" onClick={endSession}>
        ✕
      </button>
      <div className="row" style={{ minHeight: 48, justifyContent: 'center' }}>
        {listening && (
          <span className="listening" data-testid="listening" aria-label="Listen">
            👂
          </span>
        )}
      </div>
      <ProgressTrail answers={session.answers} target={session.target} />
      <div className="center">
        <button
          className="icon-button big"
          aria-label="Hear it again"
          disabled={inputLocked}
          onClick={() =>
            session.currentChordId && play(session.currentChordId, randomDuration(Math.random))
          }
        >
          🔊
        </button>
      </div>
      {milestone !== null && (
        <div className="milestone-pop" data-testid="milestone-pop" aria-hidden="true">
          {milestone}
        </div>
      )}
      <TileGrid count={unlocked.length}>
        {unlocked.map((id) => (
          <ChordTile
            key={id}
            chord={chordById(id)}
            showLetters={settings.showLetters}
            napping={progression.napping === id}
            flash={flashFor(id)}
            disabled={inputLocked || progression.napping === id}
            onTap={onTap}
          />
        ))}
      </TileGrid>
    </div>
  )
}
