const anchors = new Map<string, HTMLElement>()

export function registerAnchor(id: string, el: HTMLElement | null): void {
  if (el) anchors.set(id, el)
  else anchors.delete(id)
}

export interface AnchorRect {
  left: number
  top: number
  width: number
  height: number
}

export function anchorRect(id: string): AnchorRect | null {
  const el = anchors.get(id)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

export function anchorCenter(id: string): { x: number; y: number } | null {
  const r = anchorRect(id)
  if (!r) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
