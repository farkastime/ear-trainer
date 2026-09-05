import { useEffect, useRef, useState } from 'react'
import { loadWithFallback } from '../../audio/loading'
import { chordById } from '../../core/content/chords'
import { awakeChordIds, unlockedChordIds } from '../../core/content/curriculum'
import { DEFAULT_INSTRUMENT_ID, instrumentById } from '../../core/content/instruments'
import { activeProfile, useAppStore } from '../../state/store'
import { useAudio } from '../AudioContext'
import { ChordTile } from '../components/ChordTile'
import { TileGrid } from '../components/TileGrid'
import { usePrimer } from '../hooks/usePrimer'

export const SLOW_LOAD_MS = 6000
/** Browsers only start audio from a user gesture; past this wait we ask for a tap. */
export const UNLOCK_WAIT_MS = 1000
/** The run-through plays each awake chord in turn, lighting its tile. */
export const RUN_STEP_MS = 1400
const RUN_SECONDS = 1.2

type Stage = 'loading' | 'tap' | 'run' | 'error'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function GetReady() {
  const profile = useAppStore(activeProfile)
  const session = useAppStore((s) => s.session)
  const startSession = useAppStore((s) => s.startSession)
  const goTo = useAppStore((s) => s.goTo)
  const setAudioFallback = useAppStore((s) => s.setAudioFallback)
  const { player } = useAudio()
  const [stage, setStage] = useState<Stage>('loading')
  const [slow, setSlow] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [runIds, setRunIds] = useState<string[] | null>(null)
  const tapped = useRef<(() => void) | null>(null)
  const resuming = useRef(false)

  function proceed() {
    setRunIds(null)
    if (resuming.current) goTo('session')
    else startSession()
  }

  const { activeId } = usePrimer(runIds, {
    onStep: (id) => player.playChord([...chordById(id).notes], RUN_SECONDS),
    onDone: proceed,
    stepMs: RUN_STEP_MS,
  })

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    setStage('loading')
    setSlow(false)
    setRunIds(null)
    const slowTimer = setTimeout(() => setSlow(true), SLOW_LOAD_MS)
    resuming.current = session !== null && session.phase !== 'summary'
    const awake = awakeChordIds(profile.progression)
    const notes = awake.flatMap((id) => [...chordById(id).notes])
    const instrument = instrumentById(profile.settings.instrumentId)

    ;(async () => {
      // Decoding samples does not need a running context, so loading starts at once.
      const loading = loadWithFallback(
        player,
        instrument,
        notes,
        instrumentById(DEFAULT_INSTRUMENT_ID),
      )
      loading.catch(() => {})

      const unlockedQuickly = await Promise.race([
        player.unlock().then(() => true),
        sleep(UNLOCK_WAIT_MS).then(() => false),
      ])
      if (cancelled) return
      if (!unlockedQuickly) {
        setStage('tap')
        await new Promise<void>((resolve) => {
          tapped.current = resolve
        })
        if (cancelled) return
        setStage('loading')
      }

      const result = await loading
      if (cancelled) return
      setAudioFallback(
        result.fellBack ? { requested: instrument.id, used: result.instrument.id } : null,
      )
      clearTimeout(slowTimer)
      setStage('run')
      setRunIds(awake)
    })().catch(() => {
      if (cancelled) return
      clearTimeout(slowTimer)
      setStage('error')
    })

    return () => {
      cancelled = true
      clearTimeout(slowTimer)
      tapped.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, profile?.id])

  async function onTap() {
    // Called inside the gesture, which is what lets the audio context start.
    await player.unlock()
    tapped.current?.()
  }

  if (!profile) return null
  const unlocked = unlockedChordIds(profile.progression.unlocks)
  return (
    <div
      className="screen center"
      data-screen="getReady"
      data-testid="screen-getReady"
      style={{ justifyContent: 'center' }}
    >
      {stage === 'error' ? (
        <>
          <p style={{ fontSize: '3rem' }}>🔇</p>
          <p>We can't load the sounds right now. Check the connection and try again.</p>
          <button className="big-button" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
          <button className="big-button secondary" onClick={() => goTo('home')}>
            Back
          </button>
        </>
      ) : (
        <>
          <h1 className="screen-title" style={{ margin: 0 }}>
            Get Ready…
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Here they come!
          </p>
          <div className="parade-grid">
            <TileGrid count={unlocked.length}>
              {unlocked.map((id) => (
                <ChordTile
                  key={id}
                  chord={chordById(id)}
                  showLetters={false}
                  napping={profile.progression.napping === id}
                  flash={activeId === id ? 'highlight' : null}
                  disabled
                  onTap={() => {}}
                />
              ))}
            </TileGrid>
          </div>
          {stage === 'tap' ? (
            <button className="big-button" onClick={onTap}>
              👆 Tap to start
            </button>
          ) : stage === 'run' ? (
            <button className="link-button" onClick={proceed}>
              Skip ▶
            </button>
          ) : (
            <p className="muted" style={{ minHeight: '1.5em' }}>
              {slow ? 'Getting the sounds ready…' : ''}
            </p>
          )}
        </>
      )}
    </div>
  )
}
