import { chordById } from '../../core/content/chords'
import { awakeChordIds, newestUnlockedId } from '../../core/content/curriculum'
import { activeProfile, useAppStore } from '../../state/store'

const LINES = ['Great listening!', 'Your ears are growing!', 'Wonderful!', 'You did it!']

export function Summary() {
  const profile = useAppStore(activeProfile)
  const session = useAppStore((s) => s.session)
  const goTo = useAppStore((s) => s.goTo)
  if (!profile || !session?.summary) return null
  const { summary } = session
  const featured = summary.leveledUp
    ? chordById(newestUnlockedId(profile.progression.unlocks))
    : null
  const line = LINES[summary.count % LINES.length]

  return (
    <div
      className="screen center"
      data-screen="summary"
      data-testid="screen-summary"
      style={{ justifyContent: 'center' }}
    >
      <p className="stars" data-testid="stars" style={{ fontSize: '3rem', margin: 0 }}>
        {'⭐'.repeat(summary.stars)}
      </p>
      <h1 className="screen-title">{line}</h1>
      <p className="muted">
        {summary.correct} of {summary.count}
      </p>
      {featured && (
        <p>
          <span className="badge">
            New friend: {featured.character.emoji} {featured.character.name}
          </span>
        </p>
      )}
      <div className="character-strip" aria-label="Your friends cheer">
        {awakeChordIds(profile.progression).map((id) => (
          <span key={id} className="parade" style={{ fontSize: '2.4rem' }}>
            <span>{chordById(id).character.emoji}</span>
          </span>
        ))}
      </div>
      <div className="grow" />
      <button className="big-button" onClick={() => goTo('getReady')}>
        ▶ Play again
      </button>
      <button className="big-button secondary" onClick={() => goTo('home')}>
        🏠 Home
      </button>
    </div>
  )
}
