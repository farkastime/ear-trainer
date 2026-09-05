import { useState } from 'react'

function question() {
  const a = 2 + Math.floor(Math.random() * 8)
  const b = 2 + Math.floor(Math.random() * 8)
  return { a, b }
}

export function ParentGate({ onPass }: { onPass: () => void }) {
  const [q, setQ] = useState(question)
  const [value, setValue] = useState('')
  const [failed, setFailed] = useState(false)

  function submit() {
    if (Number(value) === q.a * q.b) {
      onPass()
      return
    }
    setFailed(true)
    setQ(question())
    setValue('')
  }

  return (
    <div className="screen" data-screen="parent" data-testid="screen-parent">
      <h1 className="screen-title">Grown-ups only</h1>
      <form
        className="card center"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <p data-testid="gate-question" style={{ fontSize: '2rem', margin: '8px 0' }}>
          {q.a} × {q.b} = ?
        </p>
        <input
          className="text-input"
          type="number"
          inputMode="numeric"
          aria-label="Answer"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {failed && <p className="muted">Try again</p>}
        <button className="big-button" type="submit" style={{ marginTop: 12 }}>
          Go
        </button>
      </form>
    </div>
  )
}
