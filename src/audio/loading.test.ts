import { describe, expect, it } from 'vitest'
import { instrumentById } from '../core/content/instruments'
import { loadWithFallback } from './loading'
import { createNullPlayer } from './player'

const noSleep = async () => {}

describe('loadWithFallback', () => {
  it('loads the requested instrument on first try', async () => {
    const player = createNullPlayer()
    const r = await loadWithFallback(
      player,
      instrumentById('organ'),
      ['C4'],
      instrumentById('piano'),
      noSleep,
    )
    expect(r).toEqual({ instrument: instrumentById('organ'), fellBack: false })
    expect(player.loaded).toEqual(['organ'])
  })

  it('retries twice then falls back to piano', async () => {
    const player = createNullPlayer()
    player.failLoads = 3
    const r = await loadWithFallback(
      player,
      instrumentById('organ'),
      ['C4'],
      instrumentById('piano'),
      noSleep,
    )
    expect(r.fellBack).toBe(true)
    expect(r.instrument.id).toBe('piano')
    expect(player.loaded).toEqual(['organ', 'organ', 'organ', 'piano'])
  })

  it('throws when the fallback also fails three times', async () => {
    const player = createNullPlayer()
    player.failLoads = 6
    await expect(
      loadWithFallback(player, instrumentById('organ'), ['C4'], instrumentById('piano'), noSleep),
    ).rejects.toThrow(/audio unavailable/)
  })

  it('does not retry the fallback separately when it is the requested instrument', async () => {
    const player = createNullPlayer()
    player.failLoads = 3
    await expect(
      loadWithFallback(player, instrumentById('piano'), ['C4'], instrumentById('piano'), noSleep),
    ).rejects.toThrow(/audio unavailable/)
    expect(player.loaded).toHaveLength(3)
  })
})
