import type { PacingParams, PacingPolicyId } from '../../types'
import { eguchi } from './eguchi'
import { manual } from './manual'
import type { PacingPolicy } from './types'
import { unlimited } from './unlimited'

export type { PacingInput, PacingPolicy, PacingVerdict } from './types'
export { eguchi, manual, unlimited }

export const DEFAULT_PACING_PARAMS: PacingParams = {
  streakTarget: 10,
  eguchiWindow: 40,
  eguchiDays: 14,
  eguchiSessions: 10,
}

export const PACING_LIMITS: Record<keyof PacingParams, [number, number]> = {
  streakTarget: [3, 50],
  eguchiWindow: [10, 200],
  eguchiDays: [0, 60],
  eguchiSessions: [0, 100],
}

export function clampPacingParams(params: PacingParams): PacingParams {
  const out = { ...params }
  for (const key of Object.keys(PACING_LIMITS) as (keyof PacingParams)[]) {
    const [min, max] = PACING_LIMITS[key]
    const value = Number.isFinite(params[key]) ? params[key] : DEFAULT_PACING_PARAMS[key]
    out[key] = Math.min(max, Math.max(min, Math.round(value)))
  }
  return out
}

const POLICIES: Record<PacingPolicyId, PacingPolicy> = { unlimited, eguchi, manual }

export function policyFor(id: PacingPolicyId): PacingPolicy {
  return POLICIES[id]
}
