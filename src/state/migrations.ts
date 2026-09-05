import type { SessionState } from '../core/engine/session'
import type { Profile } from '../core/types'

export const PERSIST_VERSION = 1

export interface PersistedSlice {
  profiles: Profile[]
  activeProfileId: string | null
  session: SessionState | null
}

export const EMPTY_SLICE: PersistedSlice = { profiles: [], activeProfileId: null, session: null }

type Migration = (state: Record<string, unknown>) => Record<string, unknown>

/** Index i migrates from version i to i+1. Empty until the shape changes. */
const MIGRATIONS: Migration[] = []

function isSlice(x: unknown): x is PersistedSlice {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return Array.isArray(o.profiles) && 'activeProfileId' in o && 'session' in o
}

export function migrate(persisted: unknown, version: number): PersistedSlice {
  if (typeof persisted !== 'object' || persisted === null || version > PERSIST_VERSION)
    return EMPTY_SLICE
  let state = persisted as Record<string, unknown>
  for (let v = version; v < PERSIST_VERSION; v++) {
    const step = MIGRATIONS[v]
    if (!step) return EMPTY_SLICE
    state = step(state)
  }
  return isSlice(state) ? state : EMPTY_SLICE
}
