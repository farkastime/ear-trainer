import type { CSSProperties } from 'react'
import { chordById } from '../../core/content/chords'
import { isChampion, unlockedChordIds } from '../../core/content/curriculum'
import { activeProfile, useAppStore } from '../../state/store'

export function Home() {
  const profile = useAppStore(activeProfile)
  const goTo = useAppStore((s) => s.goTo)
  const selectProfile = useAppStore((s) => s.selectProfile)
  if (!profile) return null
  const { progression } = profile
  const showReady = profile.settings.pacing === 'manual' && progression.readyForUnlock

  return (
    <div className="screen" data-screen="home" data-testid="screen-home">
      <div className="row">
        <button
          className="icon-button"
          aria-label="Switch profile"
          onClick={() => selectProfile(null)}
        >
          {profile.avatarEmoji}
        </button>
        <h1 className="screen-title grow">Hi, {profile.name}!</h1>
        <button className="icon-button" aria-label="Grown-ups" onClick={() => goTo('parent')}>
          ⚙️
        </button>
      </div>

      <p className="stars center">⭐ {progression.stars}</p>
      {isChampion(progression) && (
        <p className="center">
          <span className="badge">🏆 Grand Champion</span>
        </p>
      )}
      {showReady && (
        <p className="center">
          <span className="badge">Ready for a new friend! Ask a grown-up.</span>
        </p>
      )}

      <div className="character-strip" aria-label="Your friends">
        {unlockedChordIds(progression.unlocks).map((id) => {
          const chord = chordById(id)
          const napping = progression.napping === id
          return (
            <span
              key={id}
              className={`character-chip${napping ? ' napping' : ''}`}
              style={{ '--chip-color': chord.color } as CSSProperties}
              title={napping ? `${chord.character.name} is napping` : chord.character.name}
            >
              {chord.character.emoji}
            </span>
          )
        })}
      </div>

      <div className="grow" />
      <button className="big-button" onClick={() => goTo('getReady')}>
        ▶ Play
      </button>
    </div>
  )
}
