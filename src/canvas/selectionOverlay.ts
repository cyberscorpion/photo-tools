import { Rect, Ellipse } from 'fabric'
import { getFabric } from './fabricManager.ts'

let _animTimer: ReturnType<typeof setInterval> | null = null
let _offset = 0

function clearAnimation() {
  if (_animTimer !== null) { clearInterval(_animTimer); _animTimer = null }
}

function startAnimation() {
  clearAnimation()
  _animTimer = setInterval(() => {
    const fc = getFabric()
    if (!fc) return
    const sel = (fc.getObjects() as any[]).find(o => o.layerId === 'selection')
    if (!sel) { clearAnimation(); return }
    _offset = (_offset + 1) % 20
    sel.set({ strokeDashOffset: -_offset })
    fc.renderAll()
  }, 80)
}

export function clearSelectionOverlay(): void {
  clearAnimation()
  const fc = getFabric()
  if (!fc) return
  const existing = (fc.getObjects() as any[]).filter(o => o.layerId === 'selection')
  existing.forEach(o => fc.remove(o))
  if (existing.length) fc.renderAll()
}

const STYLE = {
  fill: 'rgba(0,120,215,0.08)',
  stroke: '#ffffff',
  strokeWidth: 1,
  strokeDashArray: [6, 4],
  strokeDashOffset: 0,
  selectable: false,
  evented: false,
  layerId: 'selection',
}

export function showSelectionRect(bounds: { x: number; y: number; w: number; h: number }): void {
  clearSelectionOverlay()
  const fc = getFabric()
  if (!fc) return
  const r = new Rect({ ...STYLE, left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h } as any)
  fc.add(r)
  fc.bringObjectToFront(r)
  fc.renderAll()
  startAnimation()
}

export function showSelectionEllipse(bounds: { x: number; y: number; w: number; h: number }): void {
  clearSelectionOverlay()
  const fc = getFabric()
  if (!fc) return
  const rx = bounds.w / 2, ry = bounds.h / 2
  const e = new Ellipse({ ...STYLE, left: bounds.x, top: bounds.y, rx, ry } as any)
  fc.add(e)
  fc.bringObjectToFront(e)
  fc.renderAll()
  startAnimation()
}

export function showSelectionPath(pathStr: string): void {
  // For lasso/wand — show path as marching ants
  clearSelectionOverlay()
  const fc = getFabric()
  if (!fc) return
  import('fabric').then(({ Path }) => {
    const p = new Path(pathStr, { ...STYLE } as any)
    fc.add(p)
    fc.bringObjectToFront(p)
    fc.renderAll()
    startAnimation()
  })
}
