import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../core/engine/rng'
import { burst, confetti, firework, flames, fountain, steam } from './emitters'
import { ParticleSystem } from './particles'

const sys = () => new ParticleSystem(5000, mulberry32(2))

describe('emitters', () => {
  it('burst scales with intensity', () => {
    const a = sys()
    burst(a, 0, 0, ['#f00'], 1)
    const b = sys()
    burst(b, 0, 0, ['#f00'], 0.25)
    expect(a.count).toBeGreaterThan(b.count)
    expect(b.count).toBeGreaterThan(0)
  })

  it('fountain particles start moving upward', () => {
    const s = sys()
    fountain(s, 100, 500, ['#0f0'])
    expect(s.particles.every((p) => p.vy < 0)).toBe(true)
  })

  it('firework launches one rocket whose death blooms', () => {
    const s = sys()
    firework(s, 200, 800, 200, ['#00f'])
    expect(s.count).toBe(1)
    expect(s.particles[0].trail).toBe(true)
    for (let i = 0; i < 100 && s.particles.some((p) => p.onDeath); i++) s.tick(0.05)
    expect(s.count).toBeGreaterThan(30)
  })

  it('confetti spawns across the top and falls', () => {
    const s = sys()
    confetti(s, 400, ['#fff'])
    expect(s.particles.every((p) => p.y <= 0 && p.x >= 0 && p.x <= 400)).toBe(true)
    expect(s.particles.every((p) => p.gravity > 0)).toBe(true)
  })

  it('flames emit proportionally to heat and dt, nothing when cold', () => {
    const cold = sys()
    flames(cold, 400, 800, 0, 0.016)
    expect(cold.count).toBe(0)
    const warm = sys()
    for (let i = 0; i < 60; i++) flames(warm, 400, 800, 0.5, 0.016)
    const hot = sys()
    for (let i = 0; i < 60; i++) flames(hot, 400, 800, 1, 0.016)
    expect(hot.count).toBeGreaterThan(warm.count)
    expect(warm.count).toBeGreaterThan(0)
    expect(hot.particles.every((p) => p.y >= 800 - 5 && p.vy < 0)).toBe(true)
  })

  it('steam rises from the edges', () => {
    const s = sys()
    steam(s, 400, 800)
    expect(s.count).toBeGreaterThan(0)
    expect(s.particles.every((p) => p.vy < 0)).toBe(true)
  })
})
