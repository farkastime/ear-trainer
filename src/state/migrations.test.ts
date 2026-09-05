import { describe, expect, it } from 'vitest'
import { makeProfile } from '../core/testing/fixtures'
import { EMPTY_SLICE, PERSIST_VERSION, migrate } from './migrations'

describe('migrate', () => {
  it('returns a current-version slice unchanged', () => {
    const slice = { profiles: [makeProfile()], activeProfileId: 'p1', session: null }
    expect(migrate(slice, PERSIST_VERSION)).toEqual(slice)
  })

  it('falls back to the empty slice for unrecognised shapes', () => {
    expect(migrate(null, PERSIST_VERSION)).toEqual(EMPTY_SLICE)
    expect(migrate({ profiles: 'nope' }, PERSIST_VERSION)).toEqual(EMPTY_SLICE)
    expect(migrate({ profiles: [] }, 999)).toEqual(EMPTY_SLICE)
  })
})
