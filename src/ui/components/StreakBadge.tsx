export function StreakBadge({ streak, heat }: { streak: number; heat: number }) {
  if (streak < 3) return null
  const cls = [
    'streak-badge',
    heat >= 1 ? 'blazing' : heat >= 0.66 ? 'hot' : heat >= 0.33 ? 'warm' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls} data-testid="streak-badge" aria-label={`${streak} in a row`}>
      🔥 {streak}
    </div>
  )
}
