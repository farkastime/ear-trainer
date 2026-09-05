export const APP_NAME = 'EarBuddies'

export function AppHeader() {
  return (
    <p className="app-header" aria-label={APP_NAME}>
      <span aria-hidden="true">🎧</span> {APP_NAME}
    </p>
  )
}
