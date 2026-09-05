import type { StateStorage } from 'zustand/middleware'

export const STORAGE_KEY = 'ear-trainer'
export const BACKUP_KEY = 'ear-trainer.backup'

export interface SafeStorage extends StateStorage {
  corrupted: boolean
  writeFailed: boolean
}

/** Wraps a Storage so corrupt JSON is backed up (not lost) and write failures do not throw. */
export function createSafeStorage(backing: Storage): SafeStorage {
  const safe: SafeStorage = {
    corrupted: false,
    writeFailed: false,
    getItem(name) {
      const raw = backing.getItem(name)
      if (raw === null) return null
      try {
        JSON.parse(raw)
        return raw
      } catch {
        backing.setItem(BACKUP_KEY, raw)
        backing.removeItem(name)
        safe.corrupted = true
        return null
      }
    },
    setItem(name, value) {
      try {
        backing.setItem(name, value)
      } catch {
        safe.writeFailed = true
      }
    },
    removeItem(name) {
      backing.removeItem(name)
    },
  }
  return safe
}

export function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  }
}
