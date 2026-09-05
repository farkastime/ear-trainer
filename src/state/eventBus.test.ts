import { describe, expect, it, vi } from 'vitest'
import { emitEngineEvents, onEngineEvent } from './eventBus'

describe('eventBus', () => {
  it('delivers events in order to every listener until unsubscribed', () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = onEngineEvent(a)
    onEngineEvent(b)
    emitEngineEvents([
      { type: 'readyForUnlock' },
      { type: 'streakMilestone', streak: 5, chordId: 'red' },
    ])
    expect(a.mock.calls.map((c) => c[0].type)).toEqual(['readyForUnlock', 'streakMilestone'])
    offA()
    emitEngineEvents([{ type: 'readyForUnlock' }])
    expect(a).toHaveBeenCalledTimes(2)
    expect(b).toHaveBeenCalledTimes(3)
  })

  it('a throwing listener does not stop the others', () => {
    const bad = vi.fn(() => {
      throw new Error('boom')
    })
    const good = vi.fn()
    const off1 = onEngineEvent(bad)
    const off2 = onEngineEvent(good)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    emitEngineEvents([{ type: 'readyForUnlock' }])
    expect(good).toHaveBeenCalledTimes(1)
    errSpy.mockRestore()
    off1()
    off2()
  })
})
