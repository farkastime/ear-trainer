import type { CSSProperties } from 'react'
import { registerAnchor } from '../../celebrations/anchors'
import type { Chord } from '../../core/types'

export type TileFlash = 'pop' | 'shake' | 'pulse' | 'highlight' | null

interface Props {
  chord: Chord
  showLetters: boolean
  napping: boolean
  flash: TileFlash
  disabled: boolean
  /** Not yet unlocked: colour only, the character is still to be earned. */
  locked?: boolean
  onTap: (id: string) => void
}

export function ChordTile({ chord, showLetters, napping, flash, disabled, locked, onTap }: Props) {
  const cls = ['tile', napping ? 'napping' : '', locked ? 'locked' : '', flash ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <button
      className={cls}
      data-testid={`tile-${chord.id}`}
      data-chord={chord.id}
      style={{ '--tile-color': chord.color } as CSSProperties}
      disabled={disabled}
      aria-label={locked ? 'Locked chord' : chord.character.name}
      onClick={() => onTap(chord.id)}
      ref={(el) => {
        registerAnchor(chord.id, el)
        return () => registerAnchor(chord.id, null)
      }}
    >
      {locked ? (
        <span className="lock">🔒</span>
      ) : chord.character.artUrl ? (
        <img src={chord.character.artUrl} alt="" />
      ) : (
        <span>{chord.character.emoji}</span>
      )}
      {showLetters && !locked && <span className="label">{chord.label}</span>}
    </button>
  )
}
