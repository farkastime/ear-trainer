import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { nextChordId } from '../core/content/curriculum'
import type { EngineEvent } from '../core/engine/events'
import type { Rng } from '../core/engine/rng'
import * as engine from '../core/engine/session'
import type { Profile, ProfileSettings } from '../core/types'
import { emitEngineEvents } from './eventBus'
import { parseProfileExport } from './exportImport'
import { EMPTY_SLICE, PERSIST_VERSION, migrate, type PersistedSlice } from './migrations'
import { clampSettings, newProfile } from './profile'
import { STORAGE_KEY, createSafeStorage, type SafeStorage } from './storage'
import { randomId } from './uuid'

export type Screen = 'profiles' | 'home' | 'getReady' | 'session' | 'summary' | 'parent'

export interface AppState extends PersistedSlice {
  screen: Screen
  pendingPrimer: string[] | null
  queuedPrimer: string[] | null
  storageNotice: 'corrupt' | 'writeFailed' | null
  audioFallback: { requested: string; used: string } | null
  goTo(screen: Screen): void
  createProfile(name: string, avatarEmoji: string): string
  deleteProfile(id: string): void
  selectProfile(id: string | null): void
  updateSettings(patch: Partial<ProfileSettings>): void
  startSession(): void
  answer(chordId: string): void
  advance(): void
  continueAfterLevelUp(): void
  endSession(): void
  clearPrimer(): void
  parentUnlockNext(): void
  parentWake(): void
  parentRewind(): void
  parentResetProgress(): void
  importProfile(json: string): void
  dismissNotice(): void
  setAudioFallback(value: { requested: string; used: string } | null): void
}

export interface StoreDeps {
  now: () => number
  rng: Rng
  storage: SafeStorage
  uuid: () => string
}

export function activeProfile(
  state: Pick<AppState, 'profiles' | 'activeProfileId'>,
): Profile | null {
  return state.profiles.find((p) => p.id === state.activeProfileId) ?? null
}

export function createAppStore(deps: StoreDeps) {
  const store = create<AppState>()(
    persist(
      (set, get) => {
        /** Wraps `set` so any write that fails to persist surfaces the notice. */
        const write: (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void = (
          ...args
        ) => {
          set(...args)
          if (deps.storage.writeFailed && get().storageNotice === null)
            set({ storageNotice: 'writeFailed' })
        }

        const withActive = (fn: (p: Profile) => Profile) =>
          write((s) => ({
            profiles: s.profiles.map((p) => (p.id === s.activeProfileId ? fn(p) : p)),
          }))

        /** Applies an engine result to the active profile and session, then emits its events. */
        const apply = (
          run: (
            profile: Profile,
            session: engine.SessionState | null,
          ) => engine.EngineResult | null,
        ) => {
          const s = get()
          const profile = activeProfile(s)
          if (!profile) return
          const result = run(profile, s.session)
          if (!result) return
          const patch: Partial<AppState> = {
            session: result.session,
            profiles: s.profiles.map((p) =>
              p.id === profile.id ? { ...p, progression: result.progression } : p,
            ),
          }
          if (result.session.phase === 'summary') patch.screen = 'summary'
          const woken = result.events.find(
            (e): e is Extract<EngineEvent, { type: 'chordWoken' }> => e.type === 'chordWoken',
          )
          // Queued rather than applied immediately, so the primer doesn't overlap the
          // feedback replay; `advance` promotes it to `pendingPrimer` for the next question.
          if (woken) patch.queuedPrimer = [woken.chordId]
          write(patch)
          emitEngineEvents(result.events)
        }

        const engineDeps = () => ({ now: deps.now(), rng: deps.rng })

        return {
          ...EMPTY_SLICE,
          screen: 'profiles',
          pendingPrimer: null,
          queuedPrimer: null,
          storageNotice: null,
          audioFallback: null,

          goTo: (screen) => set({ screen }),

          createProfile: (name, avatarEmoji) => {
            const profile = newProfile(name, avatarEmoji, deps.now(), deps.uuid())
            write((s) => ({
              profiles: [...s.profiles, profile],
              activeProfileId: profile.id,
              screen: 'home',
            }))
            return profile.id
          },

          deleteProfile: (id) =>
            write((s) => {
              const active = s.activeProfileId === id
              return {
                profiles: s.profiles.filter((p) => p.id !== id),
                activeProfileId: active ? null : s.activeProfileId,
                session: active ? null : s.session,
                screen: active ? 'profiles' : s.screen,
              }
            }),

          selectProfile: (id) =>
            write({ activeProfileId: id, session: null, screen: id ? 'home' : 'profiles' }),

          updateSettings: (patch) =>
            withActive((p) => ({ ...p, settings: clampSettings({ ...p.settings, ...patch }) })),

          startSession: () => {
            apply((profile) => engine.startSession(profile, engineDeps()))
            if (get().session) write({ screen: 'session', pendingPrimer: null })
          },

          answer: (chordId) =>
            apply((profile, session) =>
              session ? engine.answer(profile, session, chordId, engineDeps()) : null,
            ),

          advance: () => {
            apply((profile, session) =>
              session ? engine.advance(profile, session, engineDeps()) : null,
            )
            const queued = get().queuedPrimer
            if (queued === null) return
            if (get().session?.phase === 'question') {
              write({ pendingPrimer: queued, queuedPrimer: null })
            } else {
              write({ queuedPrimer: null })
            }
          },

          continueAfterLevelUp: () =>
            apply((profile, session) =>
              session ? engine.continueAfterLevelUp(profile, session, engineDeps()) : null,
            ),

          endSession: () =>
            apply((profile, session) =>
              session ? engine.endSession(profile, session, engineDeps()) : null,
            ),

          clearPrimer: () => write({ pendingPrimer: null }),

          parentUnlockNext: () =>
            withActive((p) => {
              const chordId = nextChordId(p.progression.unlocks)
              if (!chordId) return p
              const now = deps.now()
              return {
                ...p,
                progression: {
                  ...p.progression,
                  unlocks: [...p.progression.unlocks, { chordId, unlockedAt: now }],
                  readyForUnlock: false,
                  lastNapChangeAt: now,
                },
              }
            }),

          parentWake: () =>
            withActive((p) => ({
              ...p,
              progression: { ...p.progression, napping: null, lastNapChangeAt: deps.now() },
            })),

          parentRewind: () =>
            withActive((p) => {
              if (p.progression.unlocks.length <= 2) return p
              const unlocks = p.progression.unlocks.slice(0, -1)
              const removed = p.progression.unlocks[p.progression.unlocks.length - 1].chordId
              return {
                ...p,
                progression: {
                  ...p.progression,
                  unlocks,
                  napping: p.progression.napping === removed ? null : p.progression.napping,
                  readyForUnlock: false,
                  lastNapChangeAt: deps.now(),
                },
              }
            }),

          parentResetProgress: () =>
            withActive((p) => ({
              ...p,
              progression: newProfile(p.name, p.avatarEmoji, deps.now(), p.id).progression,
            })),

          importProfile: (json) => {
            const imported = parseProfileExport(json)
            write((s) => {
              const taken = new Set(s.profiles.map((p) => p.id))
              const id = taken.has(imported.id) ? deps.uuid() : imported.id
              return {
                profiles: [
                  ...s.profiles,
                  { ...imported, id, settings: clampSettings(imported.settings) },
                ],
              }
            })
          },

          dismissNotice: () => set({ storageNotice: null }),

          setAudioFallback: (value) => set({ audioFallback: value }),
        }
      },
      {
        name: STORAGE_KEY,
        version: PERSIST_VERSION,
        storage: createJSONStorage(() => deps.storage),
        partialize: (s): PersistedSlice => ({
          profiles: s.profiles,
          activeProfileId: s.activeProfileId,
          session: s.session,
        }),
        migrate: (persisted, version) => migrate(persisted, version) as unknown as AppState,
      },
    ),
  )
  if (deps.storage.corrupted) store.setState({ storageNotice: 'corrupt' })
  return store
}

export const useAppStore = createAppStore({
  now: () => Date.now(),
  rng: Math.random,
  storage: createSafeStorage(window.localStorage),
  uuid: randomId,
})
