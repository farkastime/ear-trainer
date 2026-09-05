import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNullSfx } from '../audio/sfx'
import { mulberry32 } from '../core/engine/rng'
import { emitEngineEvents } from '../state/eventBus'
import { useAppStore } from '../state/store'
import { renderApp, resetStore } from '../ui/testing'
import { CelebrationLayer, FIREWORK_EVERY_MS } from './CelebrationLayer'
import { ParticleSystem } from './particles'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  // jsdom logs "not implemented" for canvas 2d contexts; the layer already guards on a null ctx.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  resetStore()
  useAppStore.getState().createProfile('Ada', '🐱')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const summary = {
  startedAt: 0,
  endedAt: 1,
  count: 20,
  correct: 20,
  levelAtStart: 1,
  stars: 3,
  leveledUp: false,
  countsForPacing: true,
}

describe('CelebrationLayer', () => {
  it('sizes the canvas to the viewport in CSS pixels regardless of device pixel ratio', () => {
    const { container } = renderApp(<CelebrationLayer system={new ParticleSystem(10)} />)
    const canvases = Array.from(container.querySelectorAll('canvas'))
    expect(canvases).toHaveLength(2)
    expect(canvases[0].className).toContain('back')
    for (const canvas of canvases) {
      expect(canvas.style.width).toBe('100%')
      expect(canvas.style.height).toBe('100%')
    }
  })

  it('fires confetti on a correct answer; a miss plays the wrong sound with no particles', () => {
    const system = new ParticleSystem(5000, mulberry32(1))
    const sfx = createNullSfx()
    renderApp(<CelebrationLayer system={system} />, { sfx })
    act(() =>
      emitEngineEvents([
        { type: 'answered', chordId: 'red', chosenId: 'red', correct: true, streak: 1, heat: 0.1 },
      ]),
    )
    expect(system.count).toBeGreaterThan(0)
    expect(sfx.calls).toEqual(['pop'])
    const before = system.count
    act(() =>
      emitEngineEvents([
        {
          type: 'answered',
          chordId: 'red',
          chosenId: 'yellow',
          correct: false,
          streak: 0,
          heat: 0,
        },
      ]),
    )
    expect(system.count).toBe(before)
    expect(sfx.calls).toEqual(['pop', 'wrong'])
  })

  it('keeps launching fireworks while the level-up screen is up, and stops on Continue', () => {
    const system = new ParticleSystem(5000, mulberry32(1))
    useAppStore.getState().updateSettings({
      pacingParams: { streakTarget: 3, eguchiWindow: 40, eguchiDays: 14, eguchiSessions: 10 },
    })
    renderApp(<CelebrationLayer system={system} />)
    act(() => useAppStore.getState().startSession())
    let guard = 0
    while (useAppStore.getState().session?.phase !== 'levelUp' && guard++ < 30) {
      act(() => {
        const s = useAppStore.getState().session!
        useAppStore.getState().answer(s.currentChordId!)
        useAppStore.getState().advance()
      })
    }
    expect(useAppStore.getState().session?.phase).toBe('levelUp')
    // Without ticks nothing dies, so each launch adds exactly one rocket.
    const atLevelUp = system.count
    act(() => vi.advanceTimersByTime(FIREWORK_EVERY_MS * 3 + 10))
    expect(system.count).toBe(atLevelUp + 3)
    act(() => useAppStore.getState().continueAfterLevelUp())
    const afterContinue = system.count
    act(() => vi.advanceTimersByTime(FIREWORK_EVERY_MS * 3 + 10))
    expect(system.count).toBe(afterContinue)
  })

  it('rains confetti with a cymbal and jingle when a session completes', () => {
    const system = new ParticleSystem(5000, mulberry32(1))
    const sfx = createNullSfx()
    renderApp(<CelebrationLayer system={system} />, { sfx })
    act(() => emitEngineEvents([{ type: 'sessionComplete', summary }]))
    expect(system.count).toBeGreaterThan(100)
    expect(sfx.calls).toEqual(['cymbal', 'jingleSessionEnd'])
  })

  it('respects intensity and sound settings', () => {
    useAppStore.getState().updateSettings({ intensity: 'calm', celebrationSound: false })
    const system = new ParticleSystem(5000, mulberry32(1))
    const sfx = createNullSfx()
    renderApp(<CelebrationLayer system={system} />, { sfx })
    act(() =>
      emitEngineEvents([
        { type: 'answered', chordId: 'red', chosenId: 'red', correct: true, streak: 1, heat: 0.1 },
      ]),
    )
    expect(system.count).toBeGreaterThan(0)
    expect(system.count).toBeLessThan(20)
    expect(sfx.calls).toEqual([])
  })

  it('does nothing for an empty session', () => {
    const system = new ParticleSystem(5000, mulberry32(1))
    renderApp(<CelebrationLayer system={system} />)
    act(() =>
      emitEngineEvents([
        { type: 'sessionComplete', summary: { ...summary, count: 0, correct: 0, stars: 0 } },
      ]),
    )
    expect(system.count).toBe(0)
  })
})
