import {
  awakeChordIds,
  isChampion,
  levelOf,
  newestUnlockedId,
  nextChordId,
} from '../content/curriculum'
import {
  RECENT_ANSWERS_CAP,
  type Answer,
  type Profile,
  type Progression,
  type SessionSummary,
} from '../types'
import type { EngineEvent } from './events'
import { shouldNap, shouldWake } from './nap'
import { policyFor, unlimited } from './pacing'
import type { Rng } from './rng'
import { pickChord } from './selection'
import { MILESTONE_EVERY, heatFor, starsFor } from './stats'
import { initialWorkingSet, updateWorkingSet, type WorkingSet } from './workingSet'

export type SessionPhase = 'question' | 'feedback' | 'levelUp' | 'summary'

export interface SessionState {
  startedAt: number
  target: number
  levelAtStart: number
  answers: Answer[]
  currentChordId: string | null
  lastAskedId: string | null
  workingSet: WorkingSet
  phase: SessionPhase
  pendingLevelUp: string | null
  leveledUp: boolean
  summary: SessionSummary | null
}

export interface EngineDeps {
  now: number
  rng: Rng
}

export interface EngineResult {
  session: SessionState
  progression: Progression
  events: EngineEvent[]
}

export function workingSetIds(progression: Progression, session: SessionState): string[] {
  return awakeChordIds(progression).slice(0, session.workingSet.size)
}

function unchanged(profile: Profile, session: SessionState): EngineResult {
  return { session, progression: profile.progression, events: [] }
}

function ask(
  progression: Progression,
  session: SessionState,
  rng: Rng,
): { session: SessionState; event: EngineEvent } {
  const chordId = pickChord(
    {
      workingSet: workingSetIds(progression, session),
      recentAnswers: progression.recentAnswers,
      lastAskedId: session.lastAskedId,
      recentAskedIds: session.answers.slice(-2).map((a) => a.chordId),
      newestChordId: newestUnlockedId(progression.unlocks),
    },
    rng,
  )
  return {
    session: { ...session, currentChordId: chordId, lastAskedId: chordId, phase: 'question' },
    event: { type: 'questionAsked', chordId },
  }
}

export function startSession(profile: Profile, deps: EngineDeps): EngineResult {
  const progression: Progression = { ...profile.progression, streak: 0, heat: 0 }
  const awake = awakeChordIds(progression)
  const last = progression.sessions[progression.sessions.length - 1]
  const workingSet = initialWorkingSet(awake.length, last ? last.endedAt : null, deps.now)
  const base: SessionState = {
    startedAt: deps.now,
    target: profile.settings.sessionTarget,
    levelAtStart: levelOf(progression.unlocks),
    answers: [],
    currentChordId: null,
    lastAskedId: null,
    workingSet,
    phase: 'question',
    pendingLevelUp: null,
    leveledUp: false,
    summary: null,
  }
  const asked = ask(progression, base, deps.rng)
  return {
    session: asked.session,
    progression,
    events: [{ type: 'sessionStarted', workingSetSize: workingSet.size }, asked.event],
  }
}

export function answer(
  profile: Profile,
  session: SessionState,
  chosenId: string,
  deps: EngineDeps,
): EngineResult {
  if (session.phase !== 'question' || session.currentChordId === null)
    return unchanged(profile, session)
  const chordId = session.currentChordId
  const correct = chosenId === chordId
  const events: EngineEvent[] = []
  const record: Answer = { chordId, correct, at: deps.now }

  const stat = profile.progression.chordStats[chordId] ?? { attempts: 0, correct: 0 }
  const streak = correct ? profile.progression.streak + 1 : 0
  let progression: Progression = {
    ...profile.progression,
    chordStats: {
      ...profile.progression.chordStats,
      [chordId]: { attempts: stat.attempts + 1, correct: stat.correct + (correct ? 1 : 0) },
    },
    recentAnswers: [...profile.progression.recentAnswers, record].slice(-RECENT_ANSWERS_CAP),
    streak,
    bestStreak: Math.max(profile.progression.bestStreak, streak),
    heat: heatFor(streak),
  }
  let next: SessionState = {
    ...session,
    answers: [...session.answers, record],
    phase: 'feedback',
  }
  events.push({ type: 'answered', chordId, chosenId, correct, streak, heat: progression.heat })

  if (correct && streak % MILESTONE_EVERY === 0) {
    progression = { ...progression, stars: progression.stars + 1 }
    events.push({ type: 'streakMilestone', streak, chordId })
  }

  let awake = awakeChordIds(progression)
  let workingSet = updateWorkingSet(session.workingSet, awake.length, next.answers)

  if (shouldWake(progression, streak)) {
    const woken = progression.napping!
    progression = { ...progression, napping: null, lastNapChangeAt: deps.now }
    awake = awakeChordIds(progression)
    workingSet = { ...workingSet, size: awake.length }
    events.push({ type: 'chordWoken', chordId: woken })
  }

  if (workingSet.size !== session.workingSet.size) {
    events.push({ type: 'workingSetChanged', size: workingSet.size })
  }
  next = { ...next, workingSet }

  if (progression.napping === null && !isChampion(progression)) {
    const input = {
      progression,
      sessionStreak: streak,
      awakeChordIds: awake,
      now: deps.now,
    }
    const params = profile.settings.pacingParams
    if (policyFor(profile.settings.pacing)(input, params).ready) {
      next = { ...next, pendingLevelUp: nextChordId(progression.unlocks) }
    } else if (
      profile.settings.pacing === 'manual' &&
      !progression.readyForUnlock &&
      unlimited(input, params).ready
    ) {
      progression = { ...progression, readyForUnlock: true }
      events.push({ type: 'readyForUnlock' })
    }
  }

  return { session: next, progression, events }
}

export function advance(profile: Profile, session: SessionState, deps: EngineDeps): EngineResult {
  if (session.phase !== 'feedback') return unchanged(profile, session)

  if (session.pendingLevelUp) {
    const chordId = session.pendingLevelUp
    const progression: Progression = {
      ...profile.progression,
      unlocks: [...profile.progression.unlocks, { chordId, unlockedAt: deps.now }],
      streak: 0,
      heat: 0,
      lastNapChangeAt: deps.now,
      readyForUnlock: false,
    }
    const awake = awakeChordIds(progression)
    const next: SessionState = {
      ...session,
      phase: 'levelUp',
      pendingLevelUp: null,
      leveledUp: true,
      workingSet: { ...session.workingSet, size: awake.length },
    }
    return {
      session: next,
      progression,
      events: [{ type: 'levelUp', chordId, level: levelOf(progression.unlocks) }],
    }
  }

  if (session.answers.length >= session.target) return endSession(profile, session, deps)

  const asked = ask(profile.progression, session, deps.rng)
  return { session: asked.session, progression: profile.progression, events: [asked.event] }
}

export function continueAfterLevelUp(
  profile: Profile,
  session: SessionState,
  deps: EngineDeps,
): EngineResult {
  if (session.phase !== 'levelUp') return unchanged(profile, session)
  // The level-up closes the current session quietly (recorded, no summary) and a
  // fresh one starts with the new chord, so a late unlock is never cut short.
  const ended = endSession(profile, session, deps)
  const started = startSession({ ...profile, progression: ended.progression }, deps)
  return { session: started.session, progression: started.progression, events: started.events }
}

export function endSession(
  profile: Profile,
  session: SessionState,
  deps: EngineDeps,
): EngineResult {
  if (session.phase === 'summary') return unchanged(profile, session)
  const count = session.answers.length
  const correct = session.answers.filter((a) => a.correct).length
  const summary: SessionSummary = {
    startedAt: session.startedAt,
    endedAt: deps.now,
    count,
    correct,
    levelAtStart: session.levelAtStart,
    stars: count > 0 ? starsFor(correct, count) : 0,
    leveledUp: session.leveledUp,
    countsForPacing: count >= Math.ceil(session.target / 2),
  }
  const events: EngineEvent[] = []
  let progression = profile.progression
  if (count > 0) {
    progression = {
      ...progression,
      sessions: [...progression.sessions, summary],
      stars: progression.stars + summary.stars,
    }
    if (shouldNap(progression)) {
      const chordId = newestUnlockedId(progression.unlocks)
      progression = { ...progression, napping: chordId, lastNapChangeAt: deps.now }
      events.push({ type: 'chordNapped', chordId })
    }
  }
  events.push({ type: 'sessionComplete', summary })
  return {
    session: { ...session, phase: 'summary', currentChordId: null, summary },
    progression,
    events,
  }
}
