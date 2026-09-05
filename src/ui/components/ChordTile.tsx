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
  onTap: (id: string) => void
}

export function ChordTile({ chord, showLetters, napping, flash, disabled, onTap }: Props) {
  const cls = ['tile', napping ? 'napping' : '', flash ?? ''].filter(Boolean).join(' ')
  return (
    <button
      className={cls}
      data-testid={`tile-${chord.id}`}
      data-chord={chord.id}
      style={{ '--tile-color': chord.color } as CSSProperties}
      disabled={disabled || napping}
      aria-label={chord.character.name}
      onClick={() => onTap(chord.id)}
      ref={(el) => {
        registerAnchor(chord.id, el)
        return () => registerAnchor(chord.id, null)
      }}
    >
      {chord.character.artUrl ? (
        <img src={chord.character.artUrl} alt="" />
      ) : (
        <span>{chord.character.emoji}</span>
      )}
      {showLetters && <span className="label">{chord.label}</span>}
    </button>
  )
}
