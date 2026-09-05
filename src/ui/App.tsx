import { useEffect } from 'react'
import { CelebrationLayer } from '../celebrations/CelebrationLayer'
import { download } from '../state/exportImport'
import { useAppStore } from '../state/store'
import { BACKUP_KEY } from '../state/storage'
import { GetReady } from './screens/GetReady'
import { Home } from './screens/Home'
import { LevelUp } from './screens/LevelUp'
import { ParentSettings } from './screens/ParentSettings'
import { ProfilePicker } from './screens/ProfilePicker'
import { Session } from './screens/Session'
import { Summary } from './screens/Summary'

function StorageNotice() {
  const notice = useAppStore((s) => s.storageNotice)
  const dismiss = useAppStore((s) => s.dismissNotice)
  if (!notice) return null
  const text =
    notice === 'corrupt'
      ? 'Saved progress could not be read. A backup was kept and the app started fresh.'
      : 'Progress could not be saved on this device. Check free space or private-browsing settings.'
  const backup = notice === 'corrupt' ? window.localStorage.getItem(BACKUP_KEY) : null
  return (
    <div className="card" role="alert" style={{ margin: 12 }}>
      <p>{text}</p>
      {notice === 'corrupt' && (
        <button
          className="big-button secondary"
          disabled={backup === null}
          onClick={() => backup !== null && download('ear-trainer-backup.json', backup)}
        >
          Download backup
        </button>
      )}
      <button className="big-button secondary" onClick={dismiss}>
        OK
      </button>
    </div>
  )
}

export function App() {
  const screen = useAppStore((s) => s.screen)
  const goTo = useAppStore((s) => s.goTo)
  const phase = useAppStore((s) => s.session?.phase)

  useEffect(() => {
    const { session, activeProfileId } = useAppStore.getState()
    if (!activeProfileId) return
    if (session && session.phase !== 'summary') goTo('getReady')
    else if (session && session.phase === 'summary') goTo('summary')
    else goTo('home')
    // Runs once: routes a rehydrated store to the right screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <StorageNotice />
      {screen === 'profiles' && <ProfilePicker />}
      {screen === 'home' && <Home />}
      {screen === 'getReady' && <GetReady />}
      {screen === 'session' && <Session />}
      {screen === 'session' && phase === 'levelUp' && <LevelUp />}
      {screen === 'summary' && <Summary />}
      {screen === 'parent' && <ParentSettings />}
      <CelebrationLayer />
    </>
  )
}
