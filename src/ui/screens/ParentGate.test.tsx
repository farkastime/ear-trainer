import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ParentGate } from './ParentGate'

function readQuestion(): number {
  const m = /(\d) × (\d)/.exec(screen.getByTestId('gate-question').textContent ?? '')!
  return Number(m[1]) * Number(m[2])
}

describe('ParentGate', () => {
  it('passes on the right product', () => {
    const onPass = vi.fn()
    render(<ParentGate onPass={onPass} />)
    fireEvent.change(screen.getByLabelText(/answer/i), {
      target: { value: String(readQuestion()) },
    })
    fireEvent.click(screen.getByRole('button', { name: /go/i }))
    expect(onPass).toHaveBeenCalledTimes(1)
  })

  it('rejects a wrong answer and asks again', () => {
    const onPass = vi.fn()
    render(<ParentGate onPass={onPass} />)
    fireEvent.change(screen.getByLabelText(/answer/i), {
      target: { value: String(readQuestion() + 1) },
    })
    fireEvent.click(screen.getByRole('button', { name: /go/i }))
    expect(onPass).not.toHaveBeenCalled()
    expect(screen.getByText(/try again/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/answer/i)).toHaveValue(null)
  })
})
