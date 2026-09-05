import { useEffect, useRef } from 'react'
import { chordById } from '../core/content/chords'
import type { EngineEvent } from '../core/engine/events'
import { onEngineEvent } from '../state/eventBus'
import { activeProfile, useAppStore } from '../state/store'
import { useAudio } from '../ui/AudioContext'
import { useReducedMotion } from '../ui/hooks/useReducedMotion'
import { anchorCenter } from './anchors'
import { burst, confetti, firework, flames, fountain, steam } from './emitters'
import { vibrate } from './haptics'
import { ParticleSystem } from './particles'
import { effectiveIntensity, intensityScale, moodPalette } from './presets'

const CONFETTI_COLORS = ['#ffd54f', '#4fc3f7', '#ff7043', '#66bb6a', '#ba68c8']
const MILESTONE_COLORS = ['#ffd54f', '#ffffff', '#ff7043']
const BARRAGE = 6
const BARRAGE_GAP_MS = 250
const SLOW_FRAME_S = 0.032
const SLOW_FRAMES_BEFORE_CAP = 30
const REDUCED_MAX = 600

export function CelebrationLayer({ system }: { system?: ParticleSystem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sysRef = useRef(system ?? new ParticleSystem())
  const { sfx } = useAudio()
  const reduced = useReducedMotion()
  const settings = useAppStore((s) => activeProfile(s)?.settings)
  const heat = useAppStore((s) => activeProfile(s)?.progression.heat ?? 0)
  const screen = useAppStore((s) => s.screen)
  const live = useRef({ settings, reduced, heat, screen })
  live.current = { settings, reduced, heat, screen }

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const off = onEngineEvent((e: EngineEvent) => {
      const { settings, reduced } = live.current
      const scale = intensityScale(effectiveIntensity(settings?.intensity ?? 'full', reduced))
      const sound = settings?.celebrationSound ?? true
      const haptics = settings?.haptics ?? true
      const sys = sysRef.current
      const w = window.innerWidth
      const h = window.innerHeight
      const at = (id: string) => anchorCenter(id) ?? { x: w / 2, y: h / 2 }
      const palette = (id: string) => {
        const c = chordById(id)
        return moodPalette(c.character.mood, c.color)
      }

      switch (e.type) {
        case 'answered': {
          if (e.correct) {
            const p = at(e.chordId)
            burst(sys, p.x, p.y, palette(e.chordId), scale)
            if (sound) sfx.pop()
            vibrate([20], haptics)
          } else {
            steam(sys, w, h, scale)
            if (sound) sfx.steam()
          }
          break
        }
        case 'streakMilestone':
          fountain(sys, w / 2, h * 0.8, MILESTONE_COLORS, scale)
          if (sound) sfx.whoosh()
          vibrate([30, 50, 30], haptics)
          break
        case 'chordWoken': {
          const p = at(e.chordId)
          burst(sys, p.x, p.y, palette(e.chordId), scale * 2)
          if (sound) sfx.whoosh()
          break
        }
        case 'levelUp':
          for (let i = 0; i < BARRAGE; i++) {
            timers.push(
              setTimeout(() => {
                firework(
                  sys,
                  w * (0.2 + 0.6 * Math.random()),
                  h,
                  h * (0.15 + 0.35 * Math.random()),
                  palette(e.chordId),
                  scale,
                )
              }, i * BARRAGE_GAP_MS),
            )
          }
          vibrate([50, 80, 50, 80, 120], haptics)
          break
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
          if (sound) sfx.cymbal()
          vibrate([40, 60, 40], haptics)
          break
        default:
          break
      }
    })
    return () => {
      off()
      timers.forEach(clearTimeout)
    }
  }, [sfx])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const sys = sysRef.current
    let raf = 0
    let last = performance.now()
    let slowFrames = 0

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
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
      if (ctx) {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
        sys.draw(ctx)
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

  return <canvas ref={canvasRef} className="celebration-canvas" aria-hidden="true" />
}
