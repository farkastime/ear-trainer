import { useEffect } from 'react'
import { CelebrationLayer } from '../celebrations/CelebrationLayer'
import { useAppStore } from '../state/store'
import { GetReady } from './screens/GetReady'
import { Home } from './screens/Home'
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
  return (
    <div className="card" role="alert" style={{ margin: 12 }}>
      <p>{text}</p>
      <button className="big-button secondary" onClick={dismiss}>
        OK
      </button>
    </div>
  )
}

export function App() {
  const screen = useAppStore((s) => s.screen)
  const goTo = useAppStore((s) => s.goTo)

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
      {screen === 'summary' && <Summary />}
      {screen === 'parent' && <ParentSettings />}
      <CelebrationLayer />
    </>
  )
}
