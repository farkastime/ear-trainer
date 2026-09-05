const anchors = new Map<string, HTMLElement>()

export function registerAnchor(id: string, el: HTMLElement | null): void {
  if (el) anchors.set(id, el)
  else anchors.delete(id)
}

export function anchorCenter(id: string): { x: number; y: number } | null {
  const el = anchors.get(id)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
