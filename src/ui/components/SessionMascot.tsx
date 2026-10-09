import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { effectiveIntensity } from '../../celebrations/presets'
import type { EngineEvent } from '../../core/engine/events'
import { onEngineEvent } from '../../state/eventBus'
import { activeProfile, useAppStore } from '../../state/store'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { FEEDBACK_CORRECT_MS, FEEDBACK_WRONG_MS } from '../screens/Session'

const SHEET_URL = '/mascot/placeholder.png'
/** Cell order in the sprite sheet; the index is the background-position step. */
const POSES = ['rest', 'listen', 'cheer_a', 'cheer_b', 'cheer_c', 'tilt', 'big'] as const
type Pose = (typeof POSES)[number]
const CHEERS: Pose[] = ['cheer_a', 'cheer_b', 'cheer_c']

// Each reaction ends inside the feedback window that triggered it, so the mascot
// is back at rest before the next question is asked.
const CHEER_MS = FEEDBACK_CORRECT_MS - 200
const TILT_MS = FEEDBACK_WRONG_MS - 700
const BIG_MS = 2200

type Reaction = 'cheer' | 'tilt' | 'big' | 'loop' | null

export function SessionMascot() {
  const reduced = useReducedMotion()
  const intensity = useAppStore((s) => activeProfile(s)?.settings.intensity ?? 'full')
  const phase = useAppStore((s) => s.session?.phase ?? null)
  const priming = useAppStore((s) => s.pendingPrimer !== null)
  const [pose, setPose] = useState<Pose>('rest')
  const [reaction, setReaction] = useState<Reaction>(null)
  const [loaded, setLoaded] = useState(false)
  const lastCheer = useRef<Pose | null>(null)
  const calm = effectiveIntensity(intensity, reduced) === 'calm'

  // A background-image gives no load event, so the sheet is probed once: a missing
  // file leaves the mascot unrendered instead of showing an empty box.
  useEffect(() => {
    const probe = new Image()
    probe.onload = () => setLoaded(true)
    probe.src = SHEET_URL
    return () => {
      probe.onload = null
    }
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    // ms of null means the reaction has no end of its own; something else clears it.
    const show = (next: Pose, react: Reaction, ms: number | null) => {
      setPose(next)
      setReaction(react)
      clearTimeout(timer)
      if (ms !== null) timer = setTimeout(() => setReaction(null), ms)
    }
    const off = onEngineEvent((e: EngineEvent) => {
      switch (e.type) {
        case 'answered': {
          if (e.correct) {
            const pick = CHEERS.filter((p) => p !== lastCheer.current)
            const next = pick[Math.floor(Math.random() * pick.length)] ?? 'cheer_a'
            lastCheer.current = next
            show(next, 'cheer', CHEER_MS)
          } else {
            show('tilt', 'tilt', TILT_MS)
          }
          break
        }
        case 'streakMilestone':
        case 'chordWoken':
        case 'overtime':
          show('big', 'big', BIG_MS)
          break
        case 'levelUp':
          // Unbounded: the level-up takeover waits on a Continue button.
          show('big', 'loop', null)
          break
        default:
          break
      }
    })
    return () => {
      off()
      clearTimeout(timer)
    }
  }, [])

  if (!loaded) return null

  // The level-up loop has no timer of its own; leaving the phase ends it.
  const active = reaction === 'loop' && phase !== 'levelUp' ? null : reaction
  const idle: Pose = phase === 'question' && !priming ? 'listen' : 'rest'
  const shown = active ? pose : idle
  const motion = calm ? '' : ` mascot-${active ?? 'idle'}`

  return (
    <div className={`mascot${motion}`} aria-hidden="true" data-pose={shown}>
      <div className="mascot-sprite" style={{ '--cell': POSES.indexOf(shown) } as CSSProperties} />
    </div>
  )
}
