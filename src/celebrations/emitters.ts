import type { ParticleSystem } from './particles'

const UP = -Math.PI / 2

export function burst(
  sys: ParticleSystem,
  x: number,
  y: number,
  colors: string[],
  scale = 1,
): void {
  sys.emit({
    x,
    y,
    count: Math.round(40 * scale),
    speed: [120, 420],
    angle: [0, Math.PI * 2],
    life: [0.5, 1.1],
    size: [3, 7],
    colors,
    gravity: 500,
    drag: 1.5,
  })
}

export function fountain(
  sys: ParticleSystem,
  x: number,
  y: number,
  colors: string[],
  scale = 1,
): void {
  sys.emit({
    x,
    y,
    count: Math.round(60 * scale),
    speed: [300, 650],
    angle: [UP - 0.35, UP + 0.35],
    life: [0.8, 1.6],
    size: [3, 6],
    colors,
    gravity: 700,
    drag: 0.4,
  })
}

export function firework(
  sys: ParticleSystem,
  x: number,
  startY: number,
  targetY: number,
  colors: string[],
  scale = 1,
): void {
  const flight = 0.9
  const speed = (startY - targetY) / flight
  sys.emit({
    x,
    y: startY,
    count: 1,
    speed: [speed, speed],
    angle: [UP, UP],
    life: [flight, flight],
    size: [3, 3],
    colors,
    trail: true,
    onDeath: (p) => {
      sys.emit({
        x: p.x,
        y: p.y,
        count: Math.round(90 * scale),
        speed: [150, 380],
        angle: [0, Math.PI * 2],
        life: [0.9, 1.8],
        size: [2, 5],
        colors,
        gravity: 220,
        drag: 1.2,
        trail: scale >= 1,
      })
    },
  })
}

/** Confetti cannon: lobs pieces up and to the right from one point; they drift and fall slowly. */
export function cannon(
  sys: ParticleSystem,
  x: number,
  y: number,
  colors: string[],
  scale = 1,
): void {
  sys.emit({
    x,
    y,
    count: Math.round(60 * scale),
    speed: [180, 420],
    angle: [-1.35, -0.55],
    life: [2.8, 4.2],
    size: [4, 8],
    colors,
    gravity: 220,
    drag: 1.4,
    shape: 'rect',
  })
}

export function confetti(sys: ParticleSystem, width: number, colors: string[], scale = 1): void {
  const count = Math.round(120 * scale)
  for (let i = 0; i < count; i++) {
    sys.emit({
      x: (width * i) / count,
      y: -10,
      count: 1,
      speed: [40, 140],
      angle: [Math.PI / 4, (3 * Math.PI) / 4],
      life: [2.5, 4],
      size: [4, 8],
      colors,
      gravity: 160,
      drag: 0.8,
      shape: 'rect',
    })
  }
}

/** Continuous emitter: call every frame with the frame's dt. */
export function flames(
  sys: ParticleSystem,
  width: number,
  height: number,
  heat: number,
  dt: number,
): void {
  if (heat <= 0) return
  const perSecond = 300 * heat * heat
  const count = Math.floor(perSecond * dt + (Math.random() < (perSecond * dt) % 1 ? 1 : 0))
  if (count <= 0) return
  for (let i = 0; i < count; i++) {
    sys.emit({
      x: Math.random() * width,
      y: height,
      count: 1,
      speed: [80 + 200 * heat, 160 + 320 * heat],
      angle: [UP - 0.25, UP + 0.25],
      life: [0.5, 1.0 + heat],
      size: [3, 6 + 6 * heat],
      colors: heat > 0.8 ? ['#fff3d6', '#ffd166', '#ff8c42'] : ['#ffb300', '#ff7a00', '#ff3d00'],
      gravity: -80,
      drag: 1.0,
      shape: 'circle',
    })
  }
}

export function steam(sys: ParticleSystem, width: number, height: number, scale = 1): void {
  const count = Math.round(30 * scale)
  for (let i = 0; i < count; i++) {
    const left = i % 2 === 0
    sys.emit({
      x: left ? 0 : width,
      y: height * (0.2 + 0.6 * (i / count)),
      count: 1,
      speed: [30, 90],
      angle: [UP - 0.6, UP + 0.6],
      life: [0.8, 1.4],
      size: [6, 14],
      colors: ['rgba(200,210,220,0.8)', 'rgba(230,235,240,0.7)'],
      gravity: -40,
      drag: 1.2,
    })
  }
}
