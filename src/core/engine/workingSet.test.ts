import { describe, expect, it } from 'vitest'
import type { Answer } from '../types'
import { IDLE_MS, initialWorkingSet, updateWorkingSet, type WorkingSet } from './workingSet'

const DAY = 24 * 60 * 60 * 1000
const a = (correct: boolean): Answer => ({ chordId: 'red', correct, at: 0 })
const full = (size: number): WorkingSet => ({
  size,
  widenStreak: 0,
  lastNarrowedAtCount: -Infinity,
})

describe('initialWorkingSet', () => {
  it('is the full awake set normally', () => {
    expect(initialWorkingSet(6, 1000, 1000 + DAY).size).toBe(6)
    expect(initialWorkingSet(6, null, 1000).size).toBe(6)
  })

  it('halves (rounding up, min 2) after more than 7 idle days', () => {
    expect(IDLE_MS).toBe(7 * DAY)
    expect(initialWorkingSet(6, 0, IDLE_MS + 1).size).toBe(3)
    expect(initialWorkingSet(5, 0, IDLE_MS + 1).size).toBe(3)
    expect(initialWorkingSet(2, 0, IDLE_MS + 1).size).toBe(2)
    expect(initialWorkingSet(6, 0, IDLE_MS).size).toBe(6)
  })
})

describe('updateWorkingSet', () => {
  it('narrows when last-8 accuracy drops below 60% after 5+ answers', () => {
    const answers = [a(true), a(false), a(false), a(false), a(false)]
    const ws = updateWorkingSet(full(8), 8, answers)
    expect(ws.size).toBe(4)
    expect(ws.lastNarrowedAtCount).toBe(5)
  })

  it('does not narrow before 5 answers', () => {
    expect(updateWorkingSet(full(8), 8, [a(false), a(false), a(false), a(false)]).size).toBe(8)
  })

  it('narrows at most once per 8 answers and never below 2', () => {
    let ws = full(4)
    const answers: Answer[] = []
    for (let i = 0; i < 12; i++) {
      answers.push(a(false))
      ws = updateWorkingSet(ws, 4, answers)
    }
    expect(ws.size).toBe(2)
    expect(ws.lastNarrowedAtCount).toBe(5)
  })

  it('widens by one after 3 correct in a row, up to the awake count', () => {
    let ws: WorkingSet = { size: 2, widenStreak: 0, lastNarrowedAtCount: -Infinity }
    const answers: Answer[] = []
    for (let i = 0; i < 3; i++) {
      answers.push(a(true))
      ws = updateWorkingSet(ws, 3, answers)
    }
    expect(ws.size).toBe(3)
    expect(ws.widenStreak).toBe(0)
    for (let i = 0; i < 3; i++) {
      answers.push(a(true))
      ws = updateWorkingSet(ws, 3, answers)
    }
    expect(ws.size).toBe(3)
  })

  it('a miss resets the widen streak', () => {
    let ws: WorkingSet = { size: 2, widenStreak: 2, lastNarrowedAtCount: -Infinity }
    ws = updateWorkingSet(ws, 4, [a(true), a(true), a(false)])
    expect(ws.widenStreak).toBe(0)
    expect(ws.size).toBe(2)
  })

  it('a correct answer never narrows, even with poor window accuracy', () => {
    let ws: WorkingSet = { size: 2, widenStreak: 2, lastNarrowedAtCount: -Infinity }
    const answers = [a(false), a(false), a(false), a(false), a(false), a(true), a(true), a(true)]
    ws = updateWorkingSet(ws, 8, answers)
    expect(ws.size).toBe(3)
    expect(ws.lastNarrowedAtCount).toBe(-Infinity)
  })
})
