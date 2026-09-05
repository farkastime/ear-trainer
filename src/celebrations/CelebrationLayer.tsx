import { useEffect, useRef } from 'react'
import { chordById } from '../core/content/chords'
import type { EngineEvent } from '../core/engine/events'
import { onEngineEvent } from '../state/eventBus'
import { activeProfile, useAppStore } from '../state/store'
import { useAudio } from '../ui/AudioContext'
import { useReducedMotion } from '../ui/hooks/useReducedMotion'
import { anchorRect } from './anchors'
import { cannon, confetti, firework, flames } from './emitters'
import { vibrate } from './haptics'
import { ParticleSystem } from './particles'
import { effectiveIntensity, intensityScale, moodPalette } from './presets'

const CONFETTI_COLORS = ['#ffd54f', '#4fc3f7', '#ff7043', '#66bb6a', '#ba68c8']
/** Fireworks keep launching at this rate for as long as the level-up screen is up. */
export const FIREWORK_EVERY_MS = 700
const SLOW_FRAME_S = 0.032
const SLOW_FRAMES_BEFORE_CAP = 30
const REDUCED_MAX = 600

export function CelebrationLayer({ system }: { system?: ParticleSystem }) {
  const backRef = useRef<HTMLCanvasElement>(null)
  const frontRef = useRef<HTMLCanvasElement>(null)
  const sysRef = useRef(system ?? new ParticleSystem())
  const { sfx } = useAudio()
  const reduced = useReducedMotion()
  const settings = useAppStore((s) => activeProfile(s)?.settings)
  const heat = useAppStore((s) => activeProfile(s)?.progression.heat ?? 0)
  const screen = useAppStore((s) => s.screen)
  const phase = useAppStore((s) => s.session?.phase ?? null)
  const firstTileId = useAppStore((s) => activeProfile(s)?.progression.unlocks[0]?.chordId ?? null)
  const live = useRef({ settings, reduced, heat, screen, phase, firstTileId })
  live.current = { settings, reduced, heat, screen, phase, firstTileId }

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const intervals: ReturnType<typeof setInterval>[] = []
    const off = onEngineEvent((e: EngineEvent) => {
      const { settings, reduced, firstTileId } = live.current
      const scale = intensityScale(effectiveIntensity(settings?.intensity ?? 'full', reduced))
      const sound = settings?.celebrationSound ?? true
      const haptics = settings?.haptics ?? true
      const sys = sysRef.current
      const w = window.innerWidth
      const h = window.innerHeight
      // Every in-session celebration fires from one spot just up and left of the
      // first tile, which is always on screen whatever the grid size.
      const origin = () => {
        const r = firstTileId ? anchorRect(firstTileId) : null
        return r
          ? { x: Math.max(8, r.left - 12), y: Math.max(8, r.top - 12) }
          : { x: w * 0.08, y: h * 0.3 }
      }
      const palette = (id: string) => {
        const c = chordById(id)
        return moodPalette(c.character.mood, c.color)
      }

      switch (e.type) {
        case 'answered': {
          if (e.correct) {
            const o = origin()
            cannon(sys, o.x, o.y, palette(e.chordId), scale)
            if (sound) sfx.correct(chordById(e.chordId).notes)
            vibrate([20], haptics)
          } else if (sound) {
            sfx.wrong()
          }
          break
        }
        case 'streakMilestone': {
          const o = origin()
          cannon(sys, o.x, o.y, CONFETTI_COLORS, scale * 1.6)
          if (sound) sfx.milestone(chordById(e.chordId).notes)
          vibrate([30, 50, 30], haptics)
          break
        }
        case 'chordWoken': {
          const o = origin()
          cannon(sys, o.x, o.y, palette(e.chordId), scale * 1.6)
          if (sound) sfx.whoosh()
          break
        }
        case 'levelUp': {
          const launch = () =>
            firework(
              sys,
              w * (0.15 + 0.7 * Math.random()),
              h,
              h * (0.12 + 0.4 * Math.random()),
              palette(e.chordId),
              scale,
            )
          launch()
          const id = setInterval(() => {
            if (live.current.phase !== 'levelUp') {
              clearInterval(id)
              return
            }
            launch()
          }, FIREWORK_EVERY_MS)
          intervals.push(id)
          vibrate([50, 80, 50, 80, 120], haptics)
          break
        }
        case 'sessionComplete':
          if (e.summary.count === 0) break
          confetti(sys, w, CONFETTI_COLORS, scale)
          for (let i = 0; i < 3; i++) {
            timers.push(
              setTimeout(
                () => firework(sys, w * (0.25 + 0.25 * i), h, h * 0.3, CONFETTI_COLORS, scale),
                i * 400,
              ),
            )
          }
          if (sound) {
            sfx.cymbal()
            sfx.jingleSessionEnd()
          }
          vibrate([40, 60, 40], haptics)
          break
        default:
          break
      }
    })
    return () => {
      off()
      timers.forEach(clearTimeout)
      intervals.forEach(clearInterval)
    }
  }, [sfx])

  useEffect(() => {
    const back = backRef.current
    const front = frontRef.current
    if (!back || !front) return
    const canvases = [back, front]
    const contexts = canvases.map((c) => c.getContext('2d'))
    const sys = sysRef.current
    let raf = 0
    let last = performance.now()
    let slowFrames = 0

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvases.forEach((c, i) => {
        c.width = window.innerWidth * dpr
        c.height = window.innerHeight * dpr
        contexts[i]?.setTransform(dpr, 0, 0, dpr, 0, 0)
      })
    }
    resize()
    window.addEventListener('resize', resize)

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      const { heat, screen, settings, reduced } = live.current
      const intensity = effectiveIntensity(settings?.intensity ?? 'full', reduced)
      if (screen === 'session' && intensity !== 'calm')
        flames(sys, window.innerWidth, window.innerHeight, heat, dt)
      sys.tick(dt)
      const [backCtx, frontCtx] = contexts
      if (backCtx) {
        backCtx.clearRect(0, 0, window.innerWidth, window.innerHeight)
        sys.draw(backCtx, 'back')
      }
      if (frontCtx) {
        frontCtx.clearRect(0, 0, window.innerWidth, window.innerHeight)
        sys.draw(frontCtx, 'front')
      }
      if (dt > SLOW_FRAME_S) {
        if (++slowFrames >= SLOW_FRAMES_BEFORE_CAP) sys.setMax(REDUCED_MAX)
      } else {
        slowFrames = 0
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  // Explicit CSS size: a canvas otherwise displays at its pixel size, which is
  // devicePixelRatio times the viewport and pushes everything off screen on phones.
  const size = { width: '100%', height: '100%' }
  return (
    <>
      <canvas ref={backRef} className="celebration-canvas back" style={size} aria-hidden="true" />
      <canvas ref={frontRef} className="celebration-canvas" style={size} aria-hidden="true" />
    </>
  )
}
