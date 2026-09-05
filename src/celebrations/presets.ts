import type { Intensity, Mood } from '../core/types'

const MOOD_EXTRAS: Record<Mood, string[]> = {
  bright: ['#fff59d', '#ffffff', '#ffd54f'],
  calm: ['#b3e5fc', '#ffffff', '#80deea'],
  night: ['#7986cb', '#c5cae9', '#fff9c4'],
  sad: ['#90a4ae', '#b0bec5', '#cfd8dc'],
  mysterious: ['#ba68c8', '#4dd0e1', '#ffffff'],
}

export function moodPalette(mood: Mood, base: string): string[] {
  return [base, ...MOOD_EXTRAS[mood]]
}

export function effectiveIntensity(intensity: Intensity, reducedMotion: boolean): Intensity {
  return reducedMotion ? 'calm' : intensity
}

export function intensityScale(intensity: Intensity): number {
  return intensity === 'full' ? 1 : intensity === 'medium' ? 0.6 : 0.25
}
