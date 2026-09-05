import { describe, expect, it } from 'vitest'
import { BACKUP_KEY, STORAGE_KEY, createMemoryStorage, createSafeStorage } from './storage'

describe('createSafeStorage', () => {
  it('passes valid JSON through', () => {
    const backing = createMemoryStorage()
    backing.setItem(STORAGE_KEY, '{"state":{},"version":1}')
    const safe = createSafeStorage(backing)
    expect(safe.getItem(STORAGE_KEY)).toBe('{"state":{},"version":1}')
    expect(safe.corrupted).toBe(false)
  })

  it('backs up and drops corrupt JSON', () => {
    const backing = createMemoryStorage()
    backing.setItem(STORAGE_KEY, '{not json')
    const safe = createSafeStorage(backing)
    expect(safe.getItem(STORAGE_KEY)).toBeNull()
    expect(backing.getItem(BACKUP_KEY)).toBe('{not json')
    expect(safe.corrupted).toBe(true)
  })

  it('records write failures instead of throwing', () => {
    const backing = createMemoryStorage()
    backing.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    const safe = createSafeStorage(backing)
    expect(() => safe.setItem(STORAGE_KEY, '{}')).not.toThrow()
    expect(safe.writeFailed).toBe(true)
  })

  it('removeItem works', () => {
    const backing = createMemoryStorage()
    backing.setItem(STORAGE_KEY, '{}')
    createSafeStorage(backing).removeItem(STORAGE_KEY)
    expect(backing.getItem(STORAGE_KEY)).toBeNull()
  })

  it('a failing backup write during getItem does not throw', () => {
    const backing = createMemoryStorage()
    backing.setItem(STORAGE_KEY, '{not json')
    backing.setItem = () => {
      throw new Error('quota')
    }
    const safe = createSafeStorage(backing)
    expect(() => safe.getItem(STORAGE_KEY)).not.toThrow()
    expect(safe.getItem(STORAGE_KEY)).toBeNull()
    expect(safe.corrupted).toBe(true)
    expect(safe.writeFailed).toBe(true)
  })
})
