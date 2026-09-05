import { useEffect, useRef, useState } from 'react'
import { loadWithFallback } from '../../audio/loading'
import { chordById } from '../../core/content/chords'
import { awakeChordIds, newestUnlockedId, unlockedChordIds } from '../../core/content/curriculum'
import { DEFAULT_INSTRUMENT_ID, instrumentById } from '../../core/content/instruments'
import { activeProfile, useAppStore } from '../../state/store'
import { useAudio } from '../AudioContext'
import { CharacterParade } from '../components/CharacterParade'

export const MIN_RITUAL_MS = 1500
export const LISTEN_MS = 2000
export const SLOW_LOAD_MS = 6000
/** Browsers only start audio from a user gesture; past this wait we ask for a tap. */
export const UNLOCK_WAIT_MS = 1000

type Stage = 'loading' | 'tap' | 'listen' | 'error'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function GetReady() {
  const profile = useAppStore(activeProfile)
  const session = useAppStore((s) => s.session)
  const startSession = useAppStore((s) => s.startSession)
  const goTo = useAppStore((s) => s.goTo)
  const setAudioFallback = useAppStore((s) => s.setAudioFallback)
  const { player, sfx } = useAudio()
  const [stage, setStage] = useState<Stage>('loading')
  const [slow, setSlow] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const tapped = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    setStage('loading')
    setSlow(false)
    const slowTimer = setTimeout(() => setSlow(true), SLOW_LOAD_MS)
    const resuming = session !== null && session.phase !== 'summary'
    const notes = awakeChordIds(profile.progression).flatMap((id) => [...chordById(id).notes])
    const instrument = instrumentById(profile.settings.instrumentId)

    ;(async () => {
      const minimum = sleep(MIN_RITUAL_MS)
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
      setAudioFallback(
        result.fellBack ? { requested: instrument.id, used: result.instrument.id } : null,
      )
      await minimum
      if (cancelled) return
      clearTimeout(slowTimer)
      setStage('listen')
      if (profile.settings.celebrationSound)
        sfx.readyArpeggio(chordById(newestUnlockedId(profile.progression.unlocks)).notes)
      await sleep(LISTEN_MS)
      if (cancelled) return
      if (resuming) goTo('session')
      else startSession()
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
      ) : stage === 'listen' ? (
        <div className="listen" role="status" aria-label="Get Ready!">
          <span>👂</span>
          <span>Get</span>
          <span>Ready!</span>
        </div>
      ) : (
        <>
          <CharacterParade chordIds={unlockedChordIds(profile.progression.unlocks)} />
          {stage === 'tap' ? (
            <button className="big-button" onClick={onTap}>
              👆 Tap to start
            </button>
          ) : (
            <p className="muted">{slow ? 'Getting the sounds ready…' : 'Here they come!'}</p>
          )}
        </>
      )}
    </div>
  )
}
