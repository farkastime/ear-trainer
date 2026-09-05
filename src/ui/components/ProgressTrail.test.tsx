import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Answer } from '../../core/types'
import { ProgressTrail } from './ProgressTrail'

const a = (correct: boolean): Answer => ({ chordId: 'red', correct, at: 0 })
const rowSizes = () =>
  screen
    .getAllByTestId('trail-row')
    .map((row) => row.querySelectorAll('[data-testid="trail-dot"]').length)

describe('ProgressTrail', () => {
  it('keeps ten or fewer dots on one row', () => {
    render(<ProgressTrail answers={[]} target={10} />)
    expect(rowSizes()).toEqual([10])
  })

  it('splits twenty dots into two equal rows', () => {
    render(<ProgressTrail answers={[a(true), a(false)]} target={20} />)
    expect(rowSizes()).toEqual([10, 10])
    const dots = screen.getAllByTestId('trail-dot')
    expect(dots[0].className).toContain('correct')
    expect(dots[1].className).toContain('wrong')
    expect(dots[2].className).toBe('dot')
  })

  it('splits larger targets into near-equal rows of at most ten', () => {
    render(<ProgressTrail answers={[]} target={25} />)
    expect(rowSizes()).toEqual([9, 9, 7])
  })
})
