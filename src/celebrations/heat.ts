const STOPS: [number, [number, number, number]][] = [
  [0, [255, 179, 0]],
  [0.5, [255, 110, 0]],
  [1, [255, 250, 235]],
]

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export function heatColor(heat: number): string {
  const h = clamp01(heat)
  let i = 0
  while (i < STOPS.length - 2 && h > STOPS[i + 1][0]) i++
  const [t0, a] = STOPS[i]
  const [t1, b] = STOPS[i + 1]
  const t = (h - t0) / (t1 - t0)
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `rgb(${mix(a[0], b[0])}, ${mix(a[1], b[1])}, ${mix(a[2], b[2])})`
}

export function heatVars(heat: number): Record<string, string> {
  const h = clamp01(heat)
  return {
    '--heat': String(h),
    '--heat-color': heatColor(h),
    '--heat-glow': `${Math.round(h * 90)}px`,
  }
}
