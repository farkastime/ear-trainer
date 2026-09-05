import type { Rng } from '../core/engine/rng'

export type Shape = 'circle' | 'rect' | 'spark'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  shape: Shape
  gravity: number
  drag: number
  rotation: number
  spin: number
  trail: boolean
  onDeath: ((p: Particle) => void) | null
}

export interface EmitSpec {
  x: number
  y: number
  count: number
  speed: [number, number]
  angle: [number, number]
  life: [number, number]
  size: [number, number]
  colors: string[]
  gravity?: number
  drag?: number
  shape?: Shape
  trail?: boolean
  onDeath?: (p: Particle) => void
}

const TRAIL_EVERY_S = 0.02
const TRAIL_LIFE_S = 0.3

export class ParticleSystem {
  readonly particles: Particle[] = []
  private max: number
  private trailClock = 0
  private readonly rng: Rng
  constructor(max = 1500, rng: Rng = Math.random) {
    this.max = max
    this.rng = rng
  }

  get count(): number {
    return this.particles.length
  }

  setMax(n: number): void {
    this.max = n
  }

  private range([min, max]: [number, number]): number {
    return min + (max - min) * this.rng()
  }

  emit(spec: EmitSpec): number {
    const room = Math.max(0, this.max - this.particles.length)
    const n = Math.min(room, spec.count)
    for (let i = 0; i < n; i++) {
      const speed = this.range(spec.speed)
      const angle = this.range(spec.angle)
      const life = this.range(spec.life)
      this.particles.push({
        x: spec.x,
        y: spec.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: this.range(spec.size),
        color: spec.colors[Math.floor(this.rng() * spec.colors.length)],
        shape: spec.shape ?? 'circle',
        gravity: spec.gravity ?? 0,
        drag: spec.drag ?? 0,
        rotation: this.rng() * Math.PI * 2,
        spin: (this.rng() - 0.5) * 6,
        trail: spec.trail ?? false,
        onDeath: spec.onDeath ?? null,
      })
    }
    return n
  }

  tick(dt: number): void {
    const dead: Particle[] = []
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += p.gravity * dt
      p.vx *= 1 - p.drag * dt
      p.rotation += p.spin * dt
      p.life -= dt
      if (p.life <= 0) dead.push(p)
    }
    if (dead.length) {
      const deadSet = new Set(dead)
      let w = 0
      for (const p of this.particles) if (!deadSet.has(p)) this.particles[w++] = p
      this.particles.length = w
      for (const p of dead) p.onDeath?.(p)
    }
    if (this.particles.length > this.max) this.particles.length = this.max

    this.trailClock += dt
    if (this.trailClock >= TRAIL_EVERY_S) {
      this.trailClock = 0
      for (const p of [...this.particles]) {
        if (!p.trail) continue
        this.emit({
          x: p.x,
          y: p.y,
          count: 1,
          speed: [0, 5],
          angle: [0, Math.PI * 2],
          life: [TRAIL_LIFE_S, TRAIL_LIFE_S],
          size: [p.size * 0.5, p.size * 0.5],
          colors: [p.color],
          shape: 'spark',
          gravity: 30,
        })
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife))
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.fillStyle = p.color
      ctx.strokeStyle = p.color
      if (p.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(0, 0, p.size, 0, Math.PI * 2)
        ctx.fill()
      } else if (p.shape === 'rect') {
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size)
      } else {
        ctx.lineWidth = Math.max(1, p.size * 0.5)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(-p.vx * 0.03, -p.vy * 0.03)
        ctx.stroke()
      }
      ctx.restore()
    }
  }
}
