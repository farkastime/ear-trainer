import { chordById } from '../../core/content/chords'

export function CharacterParade({ chordIds }: { chordIds: string[] }) {
  return (
    <div className="parade" aria-hidden="true">
      {chordIds.map((id, i) => (
        <span key={id} style={{ animationDelay: `${i * 120}ms` }}>
          {chordById(id).character.emoji}
        </span>
      ))}
    </div>
  )
}
