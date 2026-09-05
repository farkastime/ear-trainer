import { describe, expect, it } from 'vitest'
import { anchorCenter, registerAnchor } from './anchors'

describe('anchors', () => {
  it('returns the bounding-rect center of a registered element', () => {
    const el = document.createElement('div')
    el.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 50 }) as DOMRect
    registerAnchor('a', el)
    expect(anchorCenter('a')).toEqual({ x: 60, y: 45 })
  })

  it('removes an anchor when registered with null', () => {
    const el = document.createElement('div')
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 }) as DOMRect
    registerAnchor('b', el)
    registerAnchor('b', null)
    expect(anchorCenter('b')).toBeNull()
  })

  it('returns null for an unknown id', () => {
    expect(anchorCenter('unknown')).toBeNull()
  })
})
