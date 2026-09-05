export const APP_NAME = 'EarBuddies'

/** Fixed brand strip at the top of every screen; the level-up overlay covers it. */
export function AppHeader() {
  return (
    <p className="app-header" aria-label={APP_NAME}>
      <span aria-hidden="true">🐻🎧</span> {APP_NAME}
    </p>
  )
}
