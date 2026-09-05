import { describe, expect, it } from 'vitest'
import { heatColor, heatVars } from './heat'

describe('heat', () => {
  it('interpolates amber -> orange -> white-hot', () => {
    expect(heatColor(0)).toBe('rgb(255, 179, 0)')
    expect(heatColor(1)).toBe('rgb(255, 250, 235)')
    const mid = heatColor(0.5)
    expect(mid).toMatch(/^rgb\(255, \d+, \d+\)$/)
    expect(mid).not.toBe(heatColor(0))
  })
  it('exposes CSS variables', () => {
    const vars = heatVars(0.4)
    expect(vars['--heat']).toBe('0.4')
    expect(vars['--heat-color']).toBe(heatColor(0.4))
    expect(vars['--heat-glow']).toMatch(/px/)
  })
  it('clamps', () => {
    expect(heatVars(3)['--heat']).toBe('1')
    expect(heatVars(-1)['--heat']).toBe('0')
  })
})
