import { afterEach, describe, expect, it, vi } from 'vitest'
import { vibrate } from './haptics'

afterEach(() => vi.unstubAllGlobals())

describe('vibrate', () => {
  it('calls navigator.vibrate when enabled and supported', () => {
    const fn = vi.fn()
    vi.stubGlobal('navigator', { vibrate: fn })
    vibrate([20], true)
    expect(fn).toHaveBeenCalledWith([20])
    vibrate([20], false)
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('is a no-op without support', () => {
    vi.stubGlobal('navigator', {})
    expect(() => vibrate([20], true)).not.toThrow()
  })
})
