import { describe, expect, it } from 'vitest'
import { makeProfile } from '../core/testing/fixtures'
import { exportProfile, parseProfileExport } from './exportImport'

describe('export/import', () => {
  it('round-trips a profile', () => {
    const p = makeProfile()
    const json = exportProfile(p)
    expect(JSON.parse(json)).toMatchObject({ format: 'ear-trainer-profile', version: 1 })
    expect(parseProfileExport(json)).toEqual(p)
  })

  it('rejects garbage', () => {
    expect(() => parseProfileExport('nope')).toThrow(/invalid profile file/)
    expect(() => parseProfileExport('{"format":"other"}')).toThrow(/invalid profile file/)
    expect(() =>
      parseProfileExport('{"format":"ear-trainer-profile","version":1,"profile":{}}'),
    ).toThrow(/invalid profile file/)
    expect(() =>
      parseProfileExport(
        JSON.stringify({
          format: 'ear-trainer-profile',
          version: 1,
          profile: { ...makeProfile(), settings: null },
        }),
      ),
    ).toThrow(/invalid profile file/)
    expect(() =>
      parseProfileExport(
        JSON.stringify({
          format: 'ear-trainer-profile',
          version: 1,
          profile: {
            ...makeProfile(),
            progression: { ...makeProfile().progression, unlocks: [] },
          },
        }),
      ),
    ).toThrow(/invalid profile file/)
  })
})
