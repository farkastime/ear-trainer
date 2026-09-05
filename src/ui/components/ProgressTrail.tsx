import type { Answer } from '../../core/types'

const MAX_PER_ROW = 10

/** Dots are split into near-equal rows of at most ten so they never wrap unevenly. */
export function ProgressTrail({ answers, target }: { answers: Answer[]; target: number }) {
  const rows = Math.ceil(target / MAX_PER_ROW)
  const perRow = Math.ceil(target / rows)
  const indexes = Array.from({ length: target }, (_, i) => i)
  const chunks = Array.from({ length: rows }, (_, r) => indexes.slice(r * perRow, (r + 1) * perRow))
  return (
    <div className="trail" aria-label={`${answers.length} of ${target}`}>
      {chunks.map((chunk, r) => (
        <div key={r} className="trail-row" data-testid="trail-row">
          {chunk.map((i) => {
            const a = answers[i]
            const cls = a ? (a.correct ? 'dot correct' : 'dot wrong') : 'dot'
            return <span key={i} className={cls} data-testid="trail-dot" />
          })}
        </div>
      ))}
    </div>
  )
}
