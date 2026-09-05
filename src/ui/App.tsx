import { Component, useEffect, type ReactNode } from 'react'
import { CelebrationLayer } from '../celebrations/CelebrationLayer'
import { download } from '../state/exportImport'
import { useAppStore } from '../state/store'
import { BACKUP_KEY } from '../state/storage'
import { AppHeader } from './components/AppHeader'
import { About } from './screens/About'
import { GetReady } from './screens/GetReady'
import { Home } from './screens/Home'
import { LevelUp } from './screens/LevelUp'
import { ParentSettings } from './screens/ParentSettings'
import { ProfilePicker } from './screens/ProfilePicker'
import { Session } from './screens/Session'
import { Summary } from './screens/Summary'

/** A render error must never leave a child staring at a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error('ui crashed', error)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="screen center" data-testid="crashed" style={{ justifyContent: 'center' }}>
        <p style={{ fontSize: '3rem' }}>🙈</p>
        <p>Something went wrong.</p>
        <button className="big-button" onClick={() => window.location.reload()}>
          Start again
        </button>
      </div>
    )
  }
}

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
    <ErrorBoundary>
      <AppHeader />
      <StorageNotice />
      {screen === 'profiles' && <ProfilePicker />}
      {screen === 'home' && <Home />}
      {screen === 'getReady' && <GetReady />}
      {screen === 'session' && <Session />}
      {screen === 'session' && phase === 'levelUp' && <LevelUp />}
      {screen === 'summary' && <Summary />}
      {screen === 'parent' && <ParentSettings />}
      {screen === 'about' && <About />}
      <CelebrationLayer />
    </ErrorBoundary>
  )
}
