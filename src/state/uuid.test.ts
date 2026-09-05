import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomId } from './uuid'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => vi.unstubAllGlobals())

describe('randomId', () => {
  it('uses crypto.randomUUID when available', () => {
    expect(randomId()).toMatch(V4)
  })

  it('still produces a v4 id without randomUUID (insecure context)', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) })
    expect(typeof crypto.randomUUID).toBe('undefined')
    const a = randomId()
    const b = randomId()
    expect(a).toMatch(V4)
    expect(b).toMatch(V4)
    expect(a).not.toBe(b)
  })

  it('falls back to Math.random with no crypto at all', () => {
    vi.stubGlobal('crypto', undefined)
    expect(randomId()).toMatch(V4)
  })
})
