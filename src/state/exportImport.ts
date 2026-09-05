import type { Profile } from '../core/types'

const FORMAT = 'ear-trainer-profile'
const VERSION = 1

export function exportProfile(profile: Profile): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, profile }, null, 2)
}

function looksLikeProfile(x: unknown): x is Profile {
  if (typeof x !== 'object' || x === null) return false
  const p = x as Record<string, unknown>
  const prog = p.progression as Record<string, unknown> | undefined
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.settings === 'object' &&
    p.settings !== null &&
    prog !== undefined &&
    Array.isArray(prog.unlocks) &&
    Array.isArray(prog.sessions)
  )
}

export function parseProfileExport(json: string): Profile {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('invalid profile file')
  }
  const o = parsed as Record<string, unknown> | null
  if (!o || o.format !== FORMAT || o.version !== VERSION || !looksLikeProfile(o.profile)) {
    throw new Error('invalid profile file')
  }
  return o.profile
}
