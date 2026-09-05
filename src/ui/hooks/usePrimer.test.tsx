import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePrimer } from './usePrimer'

function Probe({
  ids,
  onStep,
  onDone,
}: {
  ids: string[] | null
  onStep: (id: string, last: boolean) => void
  onDone: () => void
}) {
  const { activeId } = usePrimer(ids, { onStep, onDone, stepMs: 100 })
  return <div data-testid="active">{activeId ?? ''}</div>
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('usePrimer', () => {
  it('steps through ids, holds the last one longer, then calls onDone', () => {
    const onStep = vi.fn()
    const onDone = vi.fn()
    const { getByTestId } = render(<Probe ids={['a', 'b', 'c']} onStep={onStep} onDone={onDone} />)
    act(() => vi.advanceTimersByTime(0))
    expect(getByTestId('active').textContent).toBe('a')
    act(() => vi.advanceTimersByTime(100))
    expect(getByTestId('active').textContent).toBe('b')
    act(() => vi.advanceTimersByTime(100))
    expect(getByTestId('active').textContent).toBe('c')
    expect(onStep.mock.calls).toEqual([
      ['a', false],
      ['b', false],
      ['c', true],
    ])
    act(() => vi.advanceTimersByTime(100))
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(60))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(getByTestId('active').textContent).toBe('')
  })

  it('does nothing for null', () => {
    const onDone = vi.fn()
    render(<Probe ids={null} onStep={vi.fn()} onDone={onDone} />)
    act(() => vi.advanceTimersByTime(1000))
    expect(onDone).not.toHaveBeenCalled()
  })
})
