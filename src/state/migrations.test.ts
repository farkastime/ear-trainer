import { describe, expect, it } from 'vitest'
import { makeProfile } from '../core/testing/fixtures'
import { EMPTY_SLICE, PERSIST_VERSION, migrate } from './migrations'

describe('migrate', () => {
  it('returns a current-version slice unchanged', () => {
    const slice = { profiles: [makeProfile()], activeProfileId: 'p1', session: null }
    expect(migrate(slice, PERSIST_VERSION)).toEqual(slice)
  })

  it('migrates a v1 slice by adding practiceAll to each profile', () => {
    const old = makeProfile()
    const { practiceAll: _dropped, ...v1Settings } = old.settings
    void _dropped
    const slice = {
      profiles: [{ ...old, settings: v1Settings }],
      activeProfileId: 'p1',
      session: null,
    }
    const out = migrate(slice, 1)
    expect(out.profiles[0].settings.practiceAll).toBe(false)
    expect(out.profiles[0].settings.sessionTarget).toBe(old.settings.sessionTarget)
    expect(out.activeProfileId).toBe('p1')
  })

  it('falls back to the empty slice for unrecognised shapes', () => {
    expect(migrate(null, PERSIST_VERSION)).toEqual(EMPTY_SLICE)
    expect(migrate({ profiles: 'nope' }, PERSIST_VERSION)).toEqual(EMPTY_SLICE)
    expect(migrate({ profiles: [] }, 999)).toEqual(EMPTY_SLICE)
  })
})
