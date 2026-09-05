import { describe, expect, it, vi } from 'vitest'
import { mulberry32 } from '../core/engine/rng'
import { ParticleSystem, type EmitSpec } from './particles'

const spec = (over: Partial<EmitSpec> = {}): EmitSpec => ({
  x: 0,
  y: 0,
  count: 10,
  speed: [1, 1],
  angle: [0, 0],
  life: [1, 1],
  size: [2, 2],
  colors: ['#fff'],
  gravity: 0,
  drag: 0,
  ...over,
})

describe('ParticleSystem', () => {
  it('emits up to the cap', () => {
    const sys = new ParticleSystem(15, mulberry32(1))
    expect(sys.emit(spec())).toBe(10)
    expect(sys.emit(spec())).toBe(5)
    expect(sys.count).toBe(15)
  })

  it('moves particles by velocity, applies gravity and drag, and ages them', () => {
    const sys = new ParticleSystem(10, mulberry32(1))
    sys.emit(
      spec({ count: 1, speed: [10, 10], angle: [0, 0], gravity: 100, drag: 0.5, life: [2, 2] }),
    )
    sys.tick(0.1)
    const p = sys.particles[0]
    expect(p.x).toBeCloseTo(1)
    expect(p.vy).toBeCloseTo(10 * (1 - 0.5 * 0.1))
    expect(p.vx).toBeCloseTo(10 * (1 - 0.5 * 0.1))
    expect(p.life).toBeCloseTo(1.9)
  })

  it('removes dead particles and fires onDeath once', () => {
    const sys = new ParticleSystem(10, mulberry32(1))
    const onDeath = vi.fn()
    sys.emit(spec({ count: 2, life: [0.5, 0.5], onDeath }))
    sys.tick(0.4)
    expect(sys.count).toBe(2)
    sys.tick(0.2)
    expect(sys.count).toBe(0)
    expect(onDeath).toHaveBeenCalledTimes(2)
  })

  it('trail particles spawn short-lived sparks behind them', () => {
    const sys = new ParticleSystem(100, mulberry32(1))
    sys.emit(spec({ count: 1, trail: true, life: [1, 1] }))
    sys.tick(0.05)
    expect(sys.count).toBeGreaterThan(1)
    expect(sys.particles.filter((p) => !p.trail).length).toBe(1)
  })

  it('draws only the requested layer when asked, and trails inherit their parent layer', () => {
    const sys = new ParticleSystem(100, mulberry32(1))
    sys.emit(spec({ count: 3, layer: 'back', shape: 'circle' }))
    sys.emit(spec({ count: 2, shape: 'circle' }))
    const arc = vi.fn()
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      arc,
      fill: vi.fn(),
      fillRect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      globalAlpha: 1,
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D
    sys.draw(ctx, 'back')
    expect(arc).toHaveBeenCalledTimes(3)
    sys.draw(ctx, 'front')
    expect(arc).toHaveBeenCalledTimes(5)
    sys.draw(ctx)
    expect(arc).toHaveBeenCalledTimes(10)

    const trails = new ParticleSystem(100, mulberry32(1))
    trails.emit(spec({ count: 1, trail: true, layer: 'back', life: [1, 1] }))
    trails.tick(0.05)
    expect(trails.particles.every((p) => p.layer === 'back')).toBe(true)
  })

  it('setMax trims the population', () => {
    const sys = new ParticleSystem(50, mulberry32(1))
    sys.emit(spec({ count: 50 }))
    sys.setMax(20)
    sys.tick(0)
    expect(sys.count).toBeLessThanOrEqual(20)
  })

  it('draws every particle', () => {
    const sys = new ParticleSystem(10, mulberry32(1))
    sys.emit(spec({ count: 3, shape: 'circle' }))
    sys.emit(spec({ count: 2, shape: 'rect' }))
    sys.emit(spec({ count: 1, shape: 'spark' }))
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      globalAlpha: 1,
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D
    sys.draw(ctx)
    expect(ctx.arc).toHaveBeenCalledTimes(3)
    expect(ctx.fillRect).toHaveBeenCalledTimes(2)
    expect(ctx.stroke).toHaveBeenCalledTimes(1)
  })
})
