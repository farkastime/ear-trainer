import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_CURRICULUM } from '../content/curriculum'
import { makeProfile } from '../testing/fixtures'
import type { Profile, SessionSummary } from '../types'
import type { EngineEvent } from './events'
import { mulberry32, type Rng } from './rng'
import {
  advance,
  answer,
  continueAfterLevelUp,
  endSession,
  startSession,
  type EngineDeps,
  type EngineResult,
  type SessionState,
  workingSetIds,
} from './session'

const DAY = 24 * 60 * 60 * 1000
// Reseeded before every test so tests are order-independent.
let rng: Rng
beforeEach(() => {
  rng = mulberry32(11)
})
const deps = (now = 1000): EngineDeps => ({ now, rng })
const types = (events: EngineEvent[]) => events.map((e) => e.type)

function withProgression(profile: Profile, r: EngineResult): Profile {
  return { ...profile, progression: r.progression }
}

/** Answer the current question correctly (or not) and advance past feedback. */
function play(profile: Profile, session: SessionState, correct: boolean, now: number) {
  const chosen = correct
    ? session.currentChordId!
    : otherThan(session.currentChordId!, profile, session)
  const a = answer(profile, session, chosen, deps(now))
  let p = withProgression(profile, a)
  const adv = advance(p, a.session, deps(now))
  p = withProgression(p, adv)
  return { profile: p, session: adv.session, events: [...a.events, ...adv.events] }
}

function otherThan(id: string, profile: Profile, session: SessionState): string {
  return workingSetIds(profile.progression, session).find((x) => x !== id)!
}

const weakSession = (endedAt: number): SessionSummary => ({
  startedAt: endedAt - 1,
  endedAt,
  count: 20,
  correct: 8,
  levelAtStart: 2,
  stars: 1,
  leveledUp: false,
  countsForPacing: true,
})

describe('startSession', () => {
  it('starts cold with a full working set and asks a question', () => {
    const profile = makeProfile({ progression: { streak: 7, heat: 0.5 } })
    const r = startSession(profile, deps())
    expect(r.progression.streak).toBe(0)
    expect(r.progression.heat).toBe(0)
    expect(r.session.phase).toBe('question')
    expect(r.session.workingSet.size).toBe(2)
    expect(['red', 'yellow']).toContain(r.session.currentChordId)
    expect(types(r.events)).toEqual(['sessionStarted', 'questionAsked'])
    expect(r.session.target).toBe(20)
    expect(r.session.levelAtStart).toBe(1)
  })

  it('narrows the working set after a week idle', () => {
    const unlocks = DEFAULT_CURRICULUM.slice(0, 6).map((chordId) => ({ chordId, unlockedAt: 0 }))
    const profile = makeProfile({
      progression: { unlocks, sessions: [weakSession(0)] },
    })
    const r = startSession(profile, deps(8 * DAY))
    expect(r.session.workingSet.size).toBe(3)
    expect(workingSetIds(r.progression, r.session)).toEqual(['red', 'yellow', 'blue'])
  })

  it('excludes a napping chord from the working set', () => {
    const unlocks = DEFAULT_CURRICULUM.slice(0, 3).map((chordId) => ({ chordId, unlockedAt: 0 }))
    const r = startSession(makeProfile({ progression: { unlocks, napping: 'blue' } }), deps())
    expect(workingSetIds(r.progression, r.session)).toEqual(['red', 'yellow'])
  })
})

describe('answer and advance', () => {
  it('records a correct answer, raises streak and heat, then asks the next question', () => {
    let profile = makeProfile()
    const start = startSession(profile, deps())
    profile = withProgression(profile, start)
    const asked = start.session.currentChordId!
    const a = answer(profile, start.session, asked, deps(2000))
    expect(a.session.phase).toBe('feedback')
    expect(a.progression.streak).toBe(1)
    expect(a.progression.bestStreak).toBe(1)
    expect(a.progression.heat).toBeCloseTo(1 / 15)
    expect(a.progression.chordStats[asked]).toEqual({ attempts: 1, correct: 1 })
    expect(a.progression.recentAnswers).toEqual([{ chordId: asked, correct: true, at: 2000 }])
    expect(a.session.streakChordIds).toEqual([asked])
    expect(a.events).toEqual([
      { type: 'answered', chordId: asked, chosenId: asked, correct: true, streak: 1, heat: 1 / 15 },
    ])
    const adv = advance(withProgression(profile, a), a.session, deps(2500))
    expect(adv.session.phase).toBe('question')
    expect(adv.session.answers).toHaveLength(1)
    expect(types(adv.events)).toEqual(['questionAsked'])
  })

  it('a wrong answer resets streak and heat and clears the streak chord set', () => {
    let profile = makeProfile()
    const start = startSession(profile, deps())
    profile = withProgression(profile, start)
    const first = play(profile, start.session, true, 2000)
    const asked = first.session.currentChordId!
    const wrong = otherThan(asked, first.profile, first.session)
    const a = answer(first.profile, first.session, wrong, deps(3000))
    expect(a.progression.streak).toBe(0)
    expect(a.progression.heat).toBe(0)
    expect(a.progression.bestStreak).toBe(1)
    expect(a.session.streakChordIds).toEqual([])
    expect(a.progression.recentAnswers.at(-1)).toEqual({ chordId: asked, correct: false, at: 3000 })
    expect(a.events[0]).toMatchObject({ type: 'answered', correct: false, chosenId: wrong })
  })

  it('awards a star at every streak milestone of 5', () => {
    let profile = makeProfile({ settings: { pacing: 'manual' } })
    const start = startSession(profile, deps())
    let session = start.session
    profile = withProgression(profile, start)
    const seen: EngineEvent[] = []
    for (let i = 0; i < 5; i++) {
      const r = play(profile, session, true, 2000 + i)
      profile = r.profile
      session = r.session
      seen.push(...r.events)
    }
    expect(seen.filter((e) => e.type === 'streakMilestone')).toEqual([
      { type: 'streakMilestone', streak: 5 },
    ])
    expect(profile.progression.stars).toBe(1)
  })

  it('ignores answers outside the question phase', () => {
    const profile = makeProfile()
    const start = startSession(profile, deps())
    const a = answer(profile, start.session, start.session.currentChordId!, deps())
    const again = answer(withProgression(profile, a), a.session, 'red', deps())
    expect(again.events).toEqual([])
    expect(again.session).toBe(a.session)
  })
})

describe('level up', () => {
  function runUntilLevelUp(profile: Profile, maxAnswers = 30) {
    const start = startSession(profile, deps())
    profile = withProgression(profile, start)
    let session = start.session
    const events: EngineEvent[] = [...start.events]
    while (
      session.phase !== 'levelUp' &&
      session.phase !== 'summary' &&
      session.answers.length < maxAnswers
    ) {
      const r = play(profile, session, true, 2000 + session.answers.length)
      profile = r.profile
      session = r.session
      events.push(...r.events)
    }
    return { profile, session, events }
  }

  it('unlocks the next chord mid-session at a streak of 10 covering every awake chord', () => {
    const { profile, session, events } = runUntilLevelUp(makeProfile())
    expect(session.phase).toBe('levelUp')
    expect(session.answers.length).toBeGreaterThanOrEqual(10)
    expect(session.answers.length).toBeLessThanOrEqual(14)
    expect(events.filter((e) => e.type === 'levelUp')).toEqual([
      { type: 'levelUp', chordId: 'blue', level: 2 },
    ])
    expect(profile.progression.unlocks.map((u) => u.chordId)).toEqual(['red', 'yellow', 'blue'])
    expect(profile.progression.unlocks[2].unlockedAt).toBe(2000 + session.answers.length - 1)
    expect(profile.progression.streak).toBe(0)
    expect(profile.progression.heat).toBe(0)
    expect(session.leveledUp).toBe(true)
    expect(session.workingSet.size).toBe(3)

    const cont = continueAfterLevelUp(profile, session, deps(5000))
    expect(cont.session.phase).toBe('question')
    expect(types(cont.events)).toEqual(['questionAsked'])
    expect(workingSetIds(cont.progression, cont.session)).toEqual(['red', 'yellow', 'blue'])
  })

  it('finishes the session instead if the target was reached at the level-up', () => {
    const { profile, session } = runUntilLevelUp(makeProfile({ settings: { sessionTarget: 10 } }))
    expect(session.phase).toBe('levelUp')
    const cont = continueAfterLevelUp(profile, session, deps(5000))
    expect(cont.session.phase).toBe('summary')
    expect(cont.session.summary?.leveledUp).toBe(true)
  })

  it('does not unlock under the Eguchi policy when the window is not full', () => {
    const { session, events } = runUntilLevelUp(makeProfile({ settings: { pacing: 'eguchi' } }))
    expect(session.phase).not.toBe('levelUp')
    expect(types(events)).not.toContain('levelUp')
  })

  it('under manual pacing flags readiness once instead of unlocking', () => {
    const { profile, session, events } = runUntilLevelUp(
      makeProfile({ settings: { pacing: 'manual' } }),
    )
    expect(session.phase).not.toBe('levelUp')
    expect(events.filter((e) => e.type === 'readyForUnlock')).toHaveLength(1)
    expect(profile.progression.readyForUnlock).toBe(true)
  })

  it('never consults pacing once every chord is unlocked', () => {
    const unlocks = DEFAULT_CURRICULUM.map((chordId) => ({ chordId, unlockedAt: 0 }))
    const { session, events } = runUntilLevelUp(
      makeProfile({
        settings: {
          pacingParams: { streakTarget: 3, eguchiWindow: 40, eguchiDays: 14, eguchiSessions: 10 },
        },
        progression: { unlocks },
      }),
      60,
    )
    expect(session.phase).not.toBe('levelUp')
    expect(types(events)).not.toContain('levelUp')
  })
})

describe('endSession', () => {
  function playN(profile: Profile, n: number, correct: (i: number) => boolean) {
    const start = startSession(profile, deps())
    profile = withProgression(profile, start)
    let session = start.session
    const events: EngineEvent[] = []
    for (let i = 0; i < n; i++) {
      const r = play(profile, session, correct(i), 2000 + i)
      profile = r.profile
      session = r.session
      events.push(...r.events)
    }
    return { profile, session, events }
  }

  it('completes at the target with a counted summary and stars', () => {
    const { profile, session, events } = playN(
      makeProfile({ settings: { pacing: 'manual' } }),
      20,
      (i) => i !== 3,
    )
    expect(session.phase).toBe('summary')
    const complete = events.find((e) => e.type === 'sessionComplete')!
    expect(complete).toMatchObject({
      type: 'sessionComplete',
      summary: {
        count: 20,
        correct: 19,
        stars: 3,
        countsForPacing: true,
        levelAtStart: 1,
        leveledUp: false,
      },
    })
    expect(profile.progression.sessions).toHaveLength(1)
    expect(profile.progression.stars).toBe(3 + 3)
  })

  it('an early exit under half the target does not count for pacing', () => {
    const r = playN(makeProfile(), 5, () => true)
    const end = endSession(r.profile, r.session, deps(9000))
    expect(end.session.phase).toBe('summary')
    expect(end.session.summary).toMatchObject({
      count: 5,
      correct: 5,
      countsForPacing: false,
      stars: 3,
      endedAt: 9000,
    })
    expect(end.progression.sessions).toHaveLength(1)
  })

  it('an exit with no answers records nothing', () => {
    const profile = makeProfile()
    const start = startSession(profile, deps())
    const end = endSession(withProgression(profile, start), start.session, deps())
    expect(end.progression.sessions).toHaveLength(0)
    expect(end.session.summary?.stars).toBe(0)
    expect(types(end.events)).toEqual(['sessionComplete'])
  })

  it('ending twice is a no-op', () => {
    const r = playN(makeProfile(), 2, () => true)
    const end = endSession(r.profile, r.session, deps())
    const twice = endSession(withProgression(r.profile, end), end.session, deps())
    expect(twice.events).toEqual([])
    expect(twice.session).toBe(end.session)
  })

  it('naps the newest chord after a second consecutive weak session', () => {
    const unlocks = DEFAULT_CURRICULUM.slice(0, 3).map((chordId) => ({ chordId, unlockedAt: 0 }))
    const profile = makeProfile({ progression: { unlocks, sessions: [weakSession(500)] } })
    const { profile: after, events } = playN(profile, 20, (i) => i % 3 === 0)
    expect(after.progression.napping).toBe('blue')
    expect(after.progression.lastNapChangeAt).toBe(2019)
    expect(events.filter((e) => e.type === 'chordNapped')).toEqual([
      { type: 'chordNapped', chordId: 'blue' },
    ])
    const next = startSession(after, deps(3000))
    expect(workingSetIds(next.progression, next.session)).toEqual(['red', 'yellow'])
  })
})

describe('wake', () => {
  it('wakes the napping chord after 5 correct in a row and widens the working set', () => {
    const unlocks = DEFAULT_CURRICULUM.slice(0, 3).map((chordId) => ({ chordId, unlockedAt: 0 }))
    let profile = makeProfile({
      settings: { pacing: 'manual' },
      progression: { unlocks, napping: 'blue' },
    })
    const start = startSession(profile, deps())
    profile = withProgression(profile, start)
    let session = start.session
    const events: EngineEvent[] = []
    for (let i = 0; i < 5; i++) {
      const r = play(profile, session, true, 2000 + i)
      profile = r.profile
      session = r.session
      events.push(...r.events)
    }
    expect(profile.progression.napping).toBeNull()
    expect(profile.progression.lastNapChangeAt).toBe(2004)
    expect(events.filter((e) => e.type === 'chordWoken')).toEqual([
      { type: 'chordWoken', chordId: 'blue' },
    ])
    expect(workingSetIds(profile.progression, session)).toEqual(['red', 'yellow', 'blue'])
  })
})
