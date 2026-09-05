import { describe, expect, it } from 'vitest'
import { effectiveIntensity, intensityScale, moodPalette } from './presets'

describe('presets', () => {
  it('reduced motion forces calm', () => {
    expect(effectiveIntensity('full', true)).toBe('calm')
    expect(effectiveIntensity('full', false)).toBe('full')
    expect(effectiveIntensity('medium', false)).toBe('medium')
  })
  it('scales by intensity', () => {
    expect(intensityScale('full')).toBe(1)
    expect(intensityScale('medium')).toBe(0.6)
    expect(intensityScale('calm')).toBe(0.25)
  })
  it('palettes include the chord color and differ by mood', () => {
    expect(moodPalette('bright', '#e53935')).toContain('#e53935')
    expect(moodPalette('night', '#212121')).not.toEqual(moodPalette('bright', '#212121'))
    expect(moodPalette('night', '#212121').length).toBeGreaterThanOrEqual(3)
  })
})
