import type { EngineEvent } from '../core/engine/events'

type Listener = (event: EngineEvent) => void

const listeners = new Set<Listener>()

export function onEngineEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitEngineEvents(events: EngineEvent[]): void {
  for (const event of events) {
    for (const listener of [...listeners]) {
      try {
        listener(event)
      } catch (err) {
        console.error('engine event listener failed', err)
      }
    }
  }
}
