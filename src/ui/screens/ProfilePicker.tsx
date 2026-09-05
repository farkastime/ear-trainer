import { useState } from 'react'
import { AppHeader } from '../components/AppHeader'
import { useAppStore } from '../../state/store'

const AVATARS = ['🐱', '🐶', '🐰', '🦊', '🐼', '🐨', '🦄', '🐸']

export function ProfilePicker() {
  const profiles = useAppStore((s) => s.profiles)
  const createProfile = useAppStore((s) => s.createProfile)
  const selectProfile = useAppStore((s) => s.selectProfile)
  const importProfile = useAppStore((s) => s.importProfile)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [importError, setImportError] = useState<string | null>(null)

  const canCreate = name.trim().length > 0

  async function onImport(file: File | undefined) {
    if (!file) return
    try {
      importProfile(await file.text())
      setImportError(null)
    } catch {
      setImportError("That file isn't an EarBuddies profile.")
    }
  }

  return (
    <div className="screen" data-screen="profiles" data-testid="screen-profiles">
      <AppHeader />
      <h1 className="screen-title">Who's playing?</h1>
      {profiles.length > 0 && (
        <div className="profile-grid">
          {profiles.map((p) => (
            <button key={p.id} className="profile-tile" onClick={() => selectProfile(p.id)}>
              <span className="avatar">{p.avatarEmoji}</span>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          if (canCreate) createProfile(name.trim(), avatar)
        }}
      >
        <h2 style={{ marginTop: 0 }}>New player</h2>
        <label>
          <span className="muted">Name</span>
          <input
            className="text-input"
            aria-label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
          />
        </label>
        <div className="emoji-choices" style={{ margin: '12px 0' }}>
          {AVATARS.map((a) => (
            <button
              type="button"
              key={a}
              className="emoji-choice"
              aria-pressed={a === avatar}
              onClick={() => setAvatar(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <button
          className="big-button"
          type="submit"
          disabled={!canCreate}
          style={{ width: '100%' }}
        >
          Let's go!
        </button>
      </form>
      <label className="muted center">
        Grown-ups: import a saved profile{' '}
        <input
          type="file"
          accept="application/json"
          onChange={(e) => onImport(e.target.files?.[0])}
        />
      </label>
      {importError && <p className="danger center">{importError}</p>}
    </div>
  )
}
