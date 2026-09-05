export function vibrate(pattern: number[], enabled: boolean): void {
  if (!enabled) return
  const nav = navigator as Navigator & { vibrate?: (p: number[]) => boolean }
  if (typeof nav.vibrate === 'function') nav.vibrate(pattern)
}
