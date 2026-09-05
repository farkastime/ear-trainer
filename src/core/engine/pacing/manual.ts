import type { PacingPolicy } from './types'

export const manual: PacingPolicy = () => ({ ready: false, reason: 'manual: parent unlocks' })
