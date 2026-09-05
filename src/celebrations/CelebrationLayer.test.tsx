import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNullSfx } from '../audio/sfx'
import { mulberry32 } from '../core/engine/rng'
import { emitEngineEvents } from '../state/eventBus'
import { useAppStore } from '../state/store'
import { renderApp, resetStore } from '../ui/testing'
import { CelebrationLayer } from './CelebrationLayer'
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
  it('bursts and pops on a correct answer, steams on a miss', () => {
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
    expect(system.count).toBeGreaterThan(before)
    expect(sfx.calls).toEqual(['pop', 'steam'])
  })

  it('launches a staggered barrage on level up and confetti on session complete', () => {
    const system = new ParticleSystem(5000, mulberry32(1))
    const sfx = createNullSfx()
    renderApp(<CelebrationLayer system={system} />, { sfx })
    act(() => emitEngineEvents([{ type: 'levelUp', chordId: 'blue', level: 2 }]))
    act(() => vi.advanceTimersByTime(0))
    expect(system.count).toBe(1)
    act(() => vi.advanceTimersByTime(1600))
    expect(system.count).toBe(6)
    act(() => emitEngineEvents([{ type: 'sessionComplete', summary }]))
    expect(system.count).toBeGreaterThan(100)
    expect(sfx.calls).toEqual(['cymbal'])
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
