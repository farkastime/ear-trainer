import type { Answer } from '../../core/types'

export function ProgressTrail({ answers, target }: { answers: Answer[]; target: number }) {
  return (
    <div className="trail" aria-label={`${answers.length} of ${target}`}>
      {Array.from({ length: target }, (_, i) => {
        const a = answers[i]
        const cls = a ? (a.correct ? 'dot correct' : 'dot wrong') : 'dot'
        return <span key={i} className={cls} data-testid="trail-dot" />
      })}
    </div>
  )
}
