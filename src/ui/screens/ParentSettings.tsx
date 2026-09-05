import { useState } from 'react'
import { chordById } from '../../core/content/chords'
import { levelOf, nextChordId, unlockedChordIds } from '../../core/content/curriculum'
import { INSTRUMENTS } from '../../core/content/instruments'
import { PACING_LIMITS } from '../../core/engine/pacing'
import type { Intensity, PacingParams, PacingPolicyId } from '../../core/types'
import { exportProfile } from '../../state/exportImport'
import { SESSION_TARGET_LIMITS } from '../../state/profile'
import { activeProfile, useAppStore } from '../../state/store'
import { ParentGate } from './ParentGate'

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ParentSettings() {
  const [passed, setPassed] = useState(false)
  if (!passed) return <ParentGate onPass={() => setPassed(true)} />
  return <SettingsBody />
}

function SettingsBody() {
  const profile = useAppStore(activeProfile)
  const session = useAppStore((s) => s.session)
  const goTo = useAppStore((s) => s.goTo)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const parentUnlockNext = useAppStore((s) => s.parentUnlockNext)
  const parentWake = useAppStore((s) => s.parentWake)
  const parentRewind = useAppStore((s) => s.parentRewind)
  const parentResetProgress = useAppStore((s) => s.parentResetProgress)
  const deleteProfile = useAppStore((s) => s.deleteProfile)
  const importProfile = useAppStore((s) => s.importProfile)
  const [importError, setImportError] = useState<string | null>(null)
  if (!profile) return null
  const { settings, progression } = profile

  const setParam = (key: keyof PacingParams, raw: string) =>
    updateSettings({ pacingParams: { ...settings.pacingParams, [key]: Number(raw) } })

  const numberField = (label: string, key: keyof PacingParams) => (
    <label>
      {label}
      <input
        type="number"
        aria-label={label}
        min={PACING_LIMITS[key][0]}
        max={PACING_LIMITS[key][1]}
        value={settings.pacingParams[key]}
        onChange={(e) => setParam(key, e.target.value)}
      />
    </label>
  )

  const nappingChord = progression.napping ? chordById(progression.napping) : null
  const next = nextChordId(progression.unlocks)
  const recentSessions = progression.sessions.slice(-10).reverse()

  return (
    <div className="screen" data-screen="parent" data-testid="screen-parent">
      <div className="row">
        <button className="icon-button" aria-label="Back" onClick={() => goTo('home')}>
          ←
        </button>
        <h1 className="screen-title grow">
          {profile.avatarEmoji} {profile.name}
        </h1>
      </div>

      <section className="card settings-section">
        <h3>Progression</h3>
        <p className="muted">
          Level {levelOf(progression.unlocks)} · {unlockedChordIds(progression.unlocks).length}{' '}
          chords unlocked
        </p>
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend className="muted">Pacing</legend>
          {(['unlimited', 'eguchi', 'manual'] as PacingPolicyId[]).map((id) => (
            <label key={id} style={{ justifyContent: 'flex-start' }}>
              <input
                type="radio"
                name="pacing"
                checked={settings.pacing === id}
                onChange={() => updateSettings({ pacing: id })}
              />
              {id === 'unlimited'
                ? 'Unlimited (streak unlocks)'
                : id === 'eguchi'
                  ? 'Eguchi (spaced, 100%)'
                  : 'Manual (parent unlocks)'}
            </label>
          ))}
        </fieldset>
        {settings.pacing === 'unlimited' &&
          numberField('Correct in a row to unlock', 'streakTarget')}
        {settings.pacing === 'eguchi' && (
          <>
            {numberField('Perfect answers in a row (window)', 'eguchiWindow')}
            {numberField('Days between unlocks', 'eguchiDays')}
            {numberField('Sessions between unlocks', 'eguchiSessions')}
          </>
        )}
        <label>
          Questions per session
          <input
            type="number"
            aria-label="Questions per session"
            min={SESSION_TARGET_LIMITS[0]}
            max={SESSION_TARGET_LIMITS[1]}
            value={settings.sessionTarget}
            onChange={(e) => updateSettings({ sessionTarget: Number(e.target.value) })}
          />
        </label>
        {progression.readyForUnlock && <p className="badge">Ready to unlock</p>}
        {nappingChord && (
          <p>
            {nappingChord.character.emoji} {nappingChord.character.name} is napping
          </p>
        )}
        {session && session.phase !== 'summary' && (
          <p className="muted">
            Session in progress · working set {session.workingSet.size} of{' '}
            {unlockedChordIds(progression.unlocks).length - (progression.napping ? 1 : 0)}
          </p>
        )}
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="big-button secondary" disabled={!next} onClick={parentUnlockNext}>
            Unlock next
          </button>
          <button className="big-button secondary" disabled={!nappingChord} onClick={parentWake}>
            Wake now
          </button>
          <button
            className="big-button secondary"
            disabled={progression.unlocks.length <= 2}
            onClick={parentRewind}
          >
            Rewind a level
          </button>
          <button
            className="big-button secondary"
            onClick={() =>
              window.confirm('Reset all progress for this player?') && parentResetProgress()
            }
          >
            Reset progress
          </button>
        </div>
      </section>

      <section className="card settings-section">
        <h3>Sound &amp; look</h3>
        <label>
          Instrument
          <select
            aria-label="Instrument"
            value={settings.instrumentId}
            onChange={(e) => updateSettings({ instrumentId: e.target.value })}
          >
            {INSTRUMENTS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.emoji} {i.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Show chord letters
          <input
            type="checkbox"
            checked={settings.showLetters}
            onChange={(e) => updateSettings({ showLetters: e.target.checked })}
          />
        </label>
        <label>
          Celebration intensity
          <select
            aria-label="Celebration intensity"
            value={settings.intensity}
            onChange={(e) => updateSettings({ intensity: e.target.value as Intensity })}
          >
            <option value="full">Full</option>
            <option value="medium">Medium</option>
            <option value="calm">Calm</option>
          </select>
        </label>
        <label>
          Celebration sounds
          <input
            type="checkbox"
            checked={settings.celebrationSound}
            onChange={(e) => updateSettings({ celebrationSound: e.target.checked })}
          />
        </label>
        <label>
          Vibration
          <input
            type="checkbox"
            checked={settings.haptics}
            onChange={(e) => updateSettings({ haptics: e.target.checked })}
          />
        </label>
      </section>

      <section className="card settings-section">
        <h3>Stats</h3>
        <p>
          Best streak: {progression.bestStreak} · Stars: {progression.stars}
        </p>
        {unlockedChordIds(progression.unlocks).map((id) => {
          const chord = chordById(id)
          const st = progression.chordStats[id] ?? { attempts: 0, correct: 0 }
          const pct = st.attempts ? Math.round((100 * st.correct) / st.attempts) : 0
          return (
            <div key={id} style={{ margin: '6px 0' }}>
              <div className="row">
                <span>
                  {chord.character.emoji} {chord.character.name}
                </span>
                <span className="grow" />
                <span className="muted">
                  {st.correct} / {st.attempts}
                </span>
              </div>
              <div className="bar">
                <div style={{ width: `${pct}%`, background: chord.color }} />
              </div>
            </div>
          )
        })}
        {recentSessions.length > 0 && (
          <>
            <h4>Recent sessions</h4>
            <ul style={{ paddingLeft: 18 }}>
              {recentSessions.map((s) => (
                <li key={s.endedAt}>
                  {new Date(s.endedAt).toLocaleDateString()} · {s.correct}/{s.count} ·{' '}
                  {'⭐'.repeat(s.stars)}
                  {s.leveledUp ? ' · level up!' : ''}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card settings-section">
        <h3>Data</h3>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button
            className="big-button secondary"
            onClick={() => download(`${profile.name}-ear-trainer.json`, exportProfile(profile))}
          >
            Export profile
          </button>
          <label className="big-button secondary" style={{ cursor: 'pointer' }}>
            Import profile
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try {
                  importProfile(await f.text())
                  setImportError(null)
                } catch {
                  setImportError("That file isn't an Ear Trainer profile.")
                }
              }}
            />
          </label>
          <button
            className="big-button secondary danger"
            onClick={() =>
              window.confirm(`Delete ${profile.name}? This cannot be undone.`) &&
              deleteProfile(profile.id)
            }
          >
            Delete profile
          </button>
        </div>
        {importError && <p className="danger">{importError}</p>}
      </section>

      <section className="card settings-section">
        <h3>Credits</h3>
        <ul style={{ paddingLeft: 18 }}>
          {INSTRUMENTS.map((i) => (
            <li key={i.id} className="muted">
              {i.name}: {i.attribution}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
