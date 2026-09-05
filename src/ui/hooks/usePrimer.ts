import { useEffect, useRef, useState } from 'react'

interface Handlers {
  onStep(id: string, last: boolean): void
  onDone(): void
  stepMs?: number
}

const LAST_HOLD_FACTOR = 1.6

export function usePrimer(ids: string[] | null, handlers: Handlers): { activeId: string | null } {
  const [activeId, setActiveId] = useState<string | null>(null)
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    if (!ids || ids.length === 0) {
      setActiveId(null)
      return
    }
    const stepMs = ref.current.stepMs ?? 1200
    let i = 0
    let timer: ReturnType<typeof setTimeout>
    const step = () => {
      if (i >= ids.length) {
        setActiveId(null)
        ref.current.onDone()
        return
      }
      const id = ids[i]
      const last = i === ids.length - 1
      setActiveId(id)
      ref.current.onStep(id, last)
      i++
      timer = setTimeout(step, last ? stepMs * LAST_HOLD_FACTOR : stepMs)
    }
    timer = setTimeout(step, 0)
    return () => clearTimeout(timer)
  }, [ids])

  return { activeId }
}
