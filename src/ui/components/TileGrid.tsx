import type { ReactNode } from 'react'

export function TileGrid({ children, count }: { children: ReactNode; count: number }) {
  const cols = count <= 4 ? 2 : count <= 9 ? 3 : 4
  return (
    <div className="tile-grid" data-testid="tile-grid" data-cols={cols}>
      {children}
    </div>
  )
}
