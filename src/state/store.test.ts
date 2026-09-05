import { beforeEach, describe, expect, it } from 'vitest'
import { mulberry32 } from '../core/engine/rng'
import { makeProfile } from '../core/testing/fixtures'
import { onEngineEvent } from './eventBus'
import { exportProfile } from './exportImport'
import { PERSIST_VERSION } from './migrations'
import { STORAGE_KEY, createMemoryStorage, createSafeStorage } from './storage'
import { activeProfile, createAppStore } from './store'

let clock = 1000
const rng = mulberry32(5)
let ids = 0

function makeStore(backing = createMemoryStorage()) {
  const storage = createSafeStorage(backing)
  const store = createAppStore({ now: () => clock, rng, storage, uuid: () => `id-${++ids}` })
  return { store, backing, storage }
}

beforeEach(() => {
  clock = 1000
  ids = 0
})

describe('profiles', () => {
  it('creates, selects and deletes profiles with screen transitions', () => {
    const { store } = makeStore()
    expect(store.getState().screen).toBe('profiles')
    const id = store.getState().createProfile('Ada', '🐱')
    expect(id).toBe('id-1')
    expect(store.getState().activeProfileId).toBe('id-1')
    expect(store.getState().screen).toBe('home')
    expect(activeProfile(store.getState())?.name).toBe('Ada')

    store.getState().selectProfile(null)
    expect(store.getState().screen).toBe('profiles')
    store.getState().selectProfile('id-1')
    expect(store.getState().screen).toBe('home')

    store.getState().deleteProfile('id-1')
    expect(store.getState().profiles).toEqual([])
    expect(store.getState().activeProfileId).toBeNull()
    expect(store.getState().screen).toBe('profiles')
  })

  it('updates and clamps settings', () => {
    const { store } = makeStore()
    store.getState().createProfile('Ada', '🐱')
    store.getState().updateSettings({ sessionTarget: 999, instrumentId: 'organ' })
    expect(activeProfile(store.getState())?.settings).toMatchObject({
      sessionTarget: 50,
      instrumentId: 'organ',
    })
  })
})

describe('session actions', () => {
  it('does not navigate to session when there is no active profile', () => {
    const { store } = makeStore()
    store.getState().startSession()
    expect(store.getState().screen).toBe('profiles')
    expect(store.getState().session).toBeNull()
  })

  it('runs a session through the engine, emits events and navigates', () => {
    const { store } = makeStore()
    const seen: string[] = []
    const off = onEngineEvent((e) => seen.push(e.type))
    store.getState().createProfile('Ada', '🐱')
    store.getState().updateSettings({ sessionTarget: 10, pacing: 'manual' })

    store.getState().startSession()
    expect(store.getState().screen).toBe('session')
    expect(store.getState().session?.phase).toBe('question')
    expect(seen).toEqual(['sessionStarted', 'questionAsked'])

    for (let i = 0; i < 10; i++) {
      clock += 1
      const s = store.getState().session!
      store.getState().answer(s.currentChordId!)
      expect(store.getState().session?.phase).toBe('feedback')
      store.getState().advance()
    }
    expect(store.getState().session?.phase).toBe('summary')
    expect(store.getState().screen).toBe('summary')
    expect(activeProfile(store.getState())?.progression.sessions).toHaveLength(1)
    expect(seen.filter((t) => t === 'sessionComplete')).toHaveLength(1)
    off()
  })

  it('does not run a primer after a level-up', () => {
    const { store } = makeStore()
    store.getState().createProfile('Ada', '🐱')
    store.getState().updateSettings({
      pacingParams: { streakTarget: 3, eguchiWindow: 40, eguchiDays: 14, eguchiSessions: 10 },
    })
    store.getState().startSession()
    let guard = 0
    while (store.getState().session?.phase !== 'levelUp' && guard++ < 20) {
      const s = store.getState().session!
      store.getState().answer(s.currentChordId!)
      store.getState().advance()
    }
    expect(store.getState().session?.phase).toBe('levelUp')
    store.getState().continueAfterLevelUp()
    expect(store.getState().pendingPrimer).toBeNull()
    expect(store.getState().session?.phase).toBe('question')
    // A fresh session began; the level-up session was recorded without a summary screen.
    expect(store.getState().session?.answers).toHaveLength(0)
    expect(store.getState().screen).toBe('session')
    expect(activeProfile(store.getState())?.progression.sessions).toHaveLength(1)
  })

  it('queues the wake primer until after the feedback for the waking answer', () => {
    const { store } = makeStore()
    store.getState().createProfile('Ada', '🐱')
    store.getState().updateSettings({ pacing: 'manual' })
    store.getState().parentUnlockNext()
    store.setState((st) => ({
      profiles: st.profiles.map((p) => ({
        ...p,
        progression: { ...p.progression, napping: 'blue' },
      })),
    }))
    store.getState().startSession()

    for (let i = 0; i < 4; i++) {
      clock += 1
      store.getState().answer(store.getState().session!.currentChordId!)
      store.getState().advance()
    }
    clock += 1
    store.getState().answer(store.getState().session!.currentChordId!)
    expect(store.getState().session?.phase).toBe('feedback')
    expect(store.getState().pendingPrimer).toBeNull()

    store.getState().advance()
    expect(store.getState().pendingPrimer).toEqual(['blue'])
  })

  it('endSession from mid-session records and navigates to summary', () => {
    const { store } = makeStore()
    store.getState().createProfile('Ada', '🐱')
    store.getState().startSession()
    const s = store.getState().session!
    store.getState().answer(s.currentChordId!)
    store.getState().advance()
    store.getState().endSession()
    expect(store.getState().screen).toBe('summary')
    expect(activeProfile(store.getState())?.progression.sessions[0]).toMatchObject({
      count: 1,
      countsForPacing: false,
    })
  })
})

describe('parent actions', () => {
  it('unlocks, rewinds, wakes and resets', () => {
    const { store } = makeStore()
    store.getState().createProfile('Ada', '🐱')
    store.getState().parentUnlockNext()
    expect(activeProfile(store.getState())?.progression.unlocks.map((u) => u.chordId)).toEqual([
      'red',
      'yellow',
      'blue',
    ])
    store.getState().parentRewind()
    expect(activeProfile(store.getState())?.progression.unlocks.map((u) => u.chordId)).toEqual([
      'red',
      'yellow',
    ])
    store.getState().parentRewind()
    expect(activeProfile(store.getState())?.progression.unlocks).toHaveLength(2)

    store.getState().parentUnlockNext()
    store.setState((st) => ({
      profiles: st.profiles.map((p) => ({
        ...p,
        progression: { ...p.progression, napping: 'blue' },
      })),
    }))
    store.getState().parentWake()
    expect(activeProfile(store.getState())?.progression.napping).toBeNull()

    store.getState().parentResetProgress()
    expect(activeProfile(store.getState())?.progression.unlocks).toHaveLength(2)
    expect(activeProfile(store.getState())?.progression.sessions).toEqual([])
  })
})

describe('persistence', () => {
  it('persists profiles and rehydrates in a fresh store', () => {
    const { store, backing } = makeStore()
    store.getState().createProfile('Ada', '🐱')
    const raw = JSON.parse(backing.getItem(STORAGE_KEY)!)
    expect(raw.version).toBe(PERSIST_VERSION)
    expect(raw.state.profiles[0].name).toBe('Ada')
    expect(raw.state.screen).toBeUndefined()

    const again = makeStore(backing)
    expect(again.store.getState().profiles[0].name).toBe('Ada')
    expect(again.store.getState().activeProfileId).toBe('id-1')
    expect(again.store.getState().screen).toBe('profiles')
  })

  it('surfaces corrupt storage as a notice and keeps a backup', () => {
    const backing = createMemoryStorage()
    backing.setItem(STORAGE_KEY, '{broken')
    const { store } = makeStore(backing)
    expect(store.getState().profiles).toEqual([])
    expect(store.getState().storageNotice).toBe('corrupt')
    expect(backing.getItem('ear-trainer.backup')).toBe('{broken')
    store.getState().dismissNotice()
    expect(store.getState().storageNotice).toBeNull()
  })

  it('round-trips setAudioFallback without persisting it', () => {
    const { store, backing } = makeStore()
    store.getState().createProfile('Ada', '🐱')
    store.getState().setAudioFallback({ requested: 'organ', used: 'piano' })
    expect(store.getState().audioFallback).toEqual({ requested: 'organ', used: 'piano' })
    const raw = JSON.parse(backing.getItem(STORAGE_KEY)!)
    expect(raw.state.audioFallback).toBeUndefined()
    store.getState().setAudioFallback(null)
    expect(store.getState().audioFallback).toBeNull()
  })

  it('imports a profile, assigning a fresh id on collision', () => {
    const { store } = makeStore()
    store.getState().createProfile('Ada', '🐱')
    const exported = exportProfile({ ...makeProfile(), id: 'id-1', name: 'Imported' })
    store.getState().importProfile(exported)
    expect(store.getState().profiles.map((p) => [p.id, p.name])).toEqual([
      ['id-1', 'Ada'],
      ['id-2', 'Imported'],
    ])
    expect(() => store.getState().importProfile('junk')).toThrow(/invalid profile file/)
  })
})

describe('write failures', () => {
  it('sets a notice when storage writes fail', () => {
    const backing = createMemoryStorage()
    const { store } = makeStore(backing)
    store.getState().createProfile('Ada', '🐱')
    backing.setItem = () => {
      throw new Error('quota')
    }
    store.getState().updateSettings({ sessionTarget: 30 })
    expect(store.getState().storageNotice).toBe('writeFailed')
  })
})
