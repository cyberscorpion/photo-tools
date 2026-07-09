import { getFabric, setSuppressHistoryBridge } from '../canvas/fabricManager.ts'

// All layerIds that are overlays / non-content objects — never treat these as the background image
const OVERLAY_LAYER_IDS = new Set(['contour', 'selection', 'crop-overlay', 'clone-overlay'])

/**
 * Get the lower (rendering) canvas element.
 * Fabric keeps it as lowerCanvasEl; if that's unavailable we fall back to a
 * DOM query on the wrapper element so the function works across all builds.
 */
export function getLowerCanvasEl(): HTMLCanvasElement | null {
  const fc = getFabric() as any
  if (!fc) return null
  // Direct property (standard Fabric v6)
  if (fc.lowerCanvasEl instanceof HTMLCanvasElement) return fc.lowerCanvasEl
  // DOM fallback: lower-canvas sits alongside upper-canvas inside the wrapper
  const upper = (fc.upperCanvasEl ?? fc.getElement?.()) as HTMLCanvasElement | undefined
  if (upper?.parentElement) {
    const lower = upper.parentElement.querySelector<HTMLCanvasElement>('canvas:not(.upper-canvas)')
    if (lower) return lower
  }
  return null
}

/** Get the lower canvas 2D context from Fabric */
export function getLowerCtx(): CanvasRenderingContext2D | null {
  return getLowerCanvasEl()?.getContext('2d') ?? null
}

/** Reload the entire lower canvas content as a new base FabricImage, replacing the background layer */
export async function reloadCanvasAsImage(): Promise<void> {
  const fc = getFabric() as any
  if (!fc) return
  const lowerEl = getLowerCanvasEl()
  if (!lowerEl) return
  const w = fc.width as number
  const h = fc.height as number

  // Capture modified lower canvas FIRST (before Fabric can overwrite it)
  const snap = document.createElement('canvas')
  snap.width = w; snap.height = h
  snap.getContext('2d')!.drawImage(lowerEl, 0, 0)
  const blob = await new Promise<Blob>((res) => snap.toBlob(b => res(b!), 'image/png'))
  const dataURL = await new Promise<string>((res) => {
    const reader = new FileReader()
    reader.onload = (ev) => res(ev.target!.result as string)
    reader.readAsDataURL(blob)
  })

  // Suppress the event bridge for ALL internal Fabric operations below.
  // sendObjectToBack() and fc.add() can fire object:modified/object:added,
  // which would push a duplicate history entry on top of the caller's
  // explicit pushHistory() call — causing "Ctrl+Z skips two operations".
  setSuppressHistoryBridge(true)
  try {
    const { FabricImage } = await import('fabric')
    const objects = (fc.getObjects() as any[])
    // Find the background image — skip ALL overlay/system objects
    const bg = objects.find((o: any) => !OVERLAY_LAYER_IDS.has(o.layerId))
    const bgLayerId = bg?.layerId ?? 'background'
    if (bg) fc.remove(bg)

    const img = await FabricImage.fromURL(dataURL)
    img.set({ left: 0, top: 0, selectable: false, evented: false, layerId: bgLayerId } as any)
    fc.add(img)
    fc.sendObjectToBack(img as any)
    fc.renderAll()
  } finally {
    setSuppressHistoryBridge(false)
  }
}

/**
 * BFS scanline flood fill.
 * Returns a Uint8Array mask (1=selected) and tight bounding box.
 */
export function floodFill(
  data: Uint8ClampedArray,
  w: number, h: number,
  startX: number, startY: number,
  tolerance: number,
  contiguous: boolean
): { mask: Uint8Array; bounds: { x: number; y: number; w: number; h: number } } {
  const mask = new Uint8Array(w * h)
  const idx = (x: number, y: number) => (y * w + x)
  const si = idx(startX, startY) * 4
  const tr = data[si], tg = data[si+1], tb = data[si+2], ta = data[si+3]

  const colorMatch = (i: number) => {
    const d = Math.abs(data[i]-tr) + Math.abs(data[i+1]-tg) + Math.abs(data[i+2]-tb) + Math.abs(data[i+3]-ta)
    return d <= tolerance * 4
  }

  if (contiguous) {
    const queue: number[] = [startY * w + startX]
    const visited = new Uint8Array(w * h)
    visited[startY * w + startX] = 1
    let minX = startX, minY = startY, maxX = startX, maxY = startY

    while (queue.length) {
      const pos = queue.pop()!
      const x = pos % w, y = Math.floor(pos / w)
      if (!colorMatch(pos * 4)) continue
      mask[pos] = 1
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
      const neighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        const ni = ny * w + nx
        if (!visited[ni]) { visited[ni] = 1; queue.push(ni) }
      }
    }
    return { mask, bounds: { x: minX, y: minY, w: maxX-minX+1, h: maxY-minY+1 } }
  } else {
    // Non-contiguous: select all matching pixels globally
    let minX = w, minY = h, maxX = 0, maxY = 0
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (colorMatch(i)) {
          mask[y * w + x] = 1
          if (x < minX) minX = x; if (x > maxX) maxX = x
          if (y < minY) minY = y; if (y > maxY) maxY = y
        }
      }
    }
    return { mask, bounds: { x: minX, y: minY, w: Math.max(0,maxX-minX+1), h: Math.max(0,maxY-minY+1) } }
  }
}

/** Apply a solid color fill to pixels covered by the mask.
 *  Accepts a binary Uint8Array (0/1) or a Float32Array (0.0–1.0) for feathered edges. */
export function applyMaskFill(
  ctx: CanvasRenderingContext2D,
  mask: Uint8Array | Float32Array,
  w: number, h: number,
  r: number, g: number, b: number, a: number
): void {
  const imgData = ctx.getImageData(0, 0, w, h)
  const d = imgData.data
  for (let i = 0; i < w * h; i++) {
    const weight = mask[i]
    if (!weight) continue
    const p = i * 4
    if (weight >= 1) {
      d[p] = r; d[p+1] = g; d[p+2] = b; d[p+3] = a
    } else {
      // Alpha-blend fill color over existing pixel according to feather weight
      d[p]   = Math.round(d[p]   * (1 - weight) + r * weight)
      d[p+1] = Math.round(d[p+1] * (1 - weight) + g * weight)
      d[p+2] = Math.round(d[p+2] * (1 - weight) + b * weight)
      d[p+3] = Math.round(d[p+3] * (1 - weight) + a * weight)
    }
  }
  ctx.putImageData(imgData, 0, 0)
}

/** Apply destination-out (erase) to pixels covered by the mask.
 *  Accepts a binary Uint8Array (0/1) or a Float32Array (0.0–1.0) for feathered edges. */
export function applyMaskErase(
  ctx: CanvasRenderingContext2D,
  mask: Uint8Array | Float32Array,
  w: number, h: number
): void {
  const imgData = ctx.getImageData(0, 0, w, h)
  const d = imgData.data
  for (let i = 0; i < w * h; i++) {
    const weight = mask[i]
    if (!weight) continue
    d[i*4+3] = Math.round(d[i*4+3] * (1 - weight))
  }
  ctx.putImageData(imgData, 0, 0)
}

/**
 * Apply Gaussian feathering to a binary selection mask.
 * Returns a Float32Array (0.0–1.0) with smooth falloff at selection edges.
 * Uses three box-blur passes to efficiently approximate a Gaussian.
 */
export function applyFeather(
  mask: Uint8Array,
  w: number, h: number,
  radius: number
): Float32Array {
  // Start with float copy of binary mask
  let buf = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) buf[i] = mask[i]
  if (radius <= 0) return buf

  const halfBox = Math.max(1, Math.round(radius))

  // Single-axis box blur helper (horizontal)
  const blurH = (src: Float32Array, dst: Float32Array) => {
    for (let y = 0; y < h; y++) {
      const base = y * w
      let sum = 0
      // Prime window
      for (let k = 0; k <= halfBox && k < w; k++) sum += src[base + k]
      for (let x = 0; x < w; x++) {
        const lo = Math.max(0, x - halfBox)
        const hi = Math.min(w - 1, x + halfBox)
        dst[base + x] = sum / (hi - lo + 1)
        if (x - halfBox >= 0) sum -= src[base + x - halfBox]
        if (x + halfBox + 1 < w) sum += src[base + x + halfBox + 1]
      }
    }
  }

  // Single-axis box blur helper (vertical)
  const blurV = (src: Float32Array, dst: Float32Array) => {
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let k = 0; k <= halfBox && k < h; k++) sum += src[k * w + x]
      for (let y = 0; y < h; y++) {
        const lo = Math.max(0, y - halfBox)
        const hi = Math.min(h - 1, y + halfBox)
        dst[y * w + x] = sum / (hi - lo + 1)
        if (y - halfBox >= 0) sum -= src[(y - halfBox) * w + x]
        if (y + halfBox + 1 < h) sum += src[(y + halfBox + 1) * w + x]
      }
    }
  }

  // 3 box-blur passes (horizontal + vertical each) ≈ Gaussian
  let tmp = new Float32Array(w * h)
  for (let pass = 0; pass < 3; pass++) {
    blurH(buf, tmp)
    const swap = buf; buf = new Float32Array(w * h); blurV(tmp, buf)
    void swap // suppress unused warning
  }

  return buf
}

/**
 * Trace the pixel-edge boundary of a binary mask and return an SVG path string.
 * The path consists of merged horizontal and vertical grid-edge segments,
 * suitable for use as marching-ants selection overlay.
 */
export function maskToOutlinePath(
  mask: Uint8Array,
  w: number, h: number,
  bounds?: { x: number; y: number; w: number; h: number }
): string {
  const bx = bounds?.x ?? 0
  const by = bounds?.y ?? 0
  const bw = bounds ? bounds.w : w
  const bh = bounds ? bounds.h : h

  const get = (x: number, y: number): number => {
    if (x < 0 || x >= w || y < 0 || y >= h) return 0
    return mask[y * w + x]
  }

  const parts: string[] = []

  // Horizontal boundary edges (between row Y-1 and row Y)
  for (let Y = by; Y <= by + bh; Y++) {
    let runStart = -1
    for (let x = bx; x < bx + bw; x++) {
      const isEdge = get(x, Y - 1) !== get(x, Y)
      if (isEdge) {
        if (runStart === -1) runStart = x
      } else {
        if (runStart !== -1) { parts.push(`M${runStart} ${Y} L${x} ${Y}`); runStart = -1 }
      }
    }
    if (runStart !== -1) parts.push(`M${runStart} ${Y} L${bx + bw} ${Y}`)
  }

  // Vertical boundary edges (between column X-1 and column X)
  for (let X = bx; X <= bx + bw; X++) {
    let runStart = -1
    for (let y = by; y < by + bh; y++) {
      const isEdge = get(X - 1, y) !== get(X, y)
      if (isEdge) {
        if (runStart === -1) runStart = y
      } else {
        if (runStart !== -1) { parts.push(`M${X} ${runStart} L${X} ${y}`); runStart = -1 }
      }
    }
    if (runStart !== -1) parts.push(`M${X} ${runStart} L${X} ${by + bh}`)
  }

  return parts.length ? parts.join(' ') : `M${bx} ${by} L${bx + bw} ${by} L${bx + bw} ${by + bh} L${bx} ${by + bh} Z`
}

/** Sample a circular region of ImageData (returns a copy) */
export function sampleCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): ImageData {
  const x = Math.round(cx - radius), y = Math.round(cy - radius)
  const size = Math.round(radius * 2)
  return ctx.getImageData(Math.max(0,x), Math.max(0,y), size, size)
}

/** Apply a simple 3×3 box blur to ImageData in-place */
export function boxBlur(data: Uint8ClampedArray, w: number, h: number, passes = 1): void {
  const buf = new Uint8ClampedArray(data)
  for (let p = 0; p < passes; p++) {
    for (let y = 1; y < h-1; y++) {
      for (let x = 1; x < w-1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
              sum += buf[((y+dy)*w+(x+dx))*4+c]
          data[(y*w+x)*4+c] = sum / 9
        }
      }
    }
    buf.set(data)
  }
}

/**
 * Generate a binary pixel mask for an ellipse on a canvas of (cw × ch) pixels.
 * Pixels whose centers fall inside the ellipse (cx, cy, rx, ry) are set to 1.
 */
export function makeEllipseMask(
  cw: number, ch: number,
  cx: number, cy: number,
  rx: number, ry: number
): Uint8Array {
  const mask = new Uint8Array(cw * ch)
  const x0 = Math.max(0, Math.floor(cx - rx))
  const x1 = Math.min(cw - 1, Math.ceil(cx + rx))
  const y0 = Math.max(0, Math.floor(cy - ry))
  const y1 = Math.min(ch - 1, Math.ceil(cy + ry))
  const rx2 = rx * rx, ry2 = ry * ry
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx
      if (dx * dx / rx2 + dy * dy / ry2 <= 1) mask[y * cw + x] = 1
    }
  }
  return mask
}

/**
 * Generate a binary pixel mask for an arbitrary closed polygon on a canvas
 * of (cw × ch) pixels. Uses an offscreen canvas fill for accuracy.
 */
export function makePolygonMask(
  cw: number, ch: number,
  points: { x: number; y: number }[]
): Uint8Array {
  const off = document.createElement('canvas')
  off.width = cw; off.height = ch
  const ctx = off.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.closePath()
  ctx.fill()
  const d = ctx.getImageData(0, 0, cw, ch).data
  const mask = new Uint8Array(cw * ch)
  for (let i = 0; i < cw * ch; i++) { if (d[i * 4 + 3] > 127) mask[i] = 1 }
  return mask
}

/** Build polygon point array for a regular N-gon */
export function buildPolygonPoints(
  cx: number, cy: number, radius: number, sides: number, startAngle = -Math.PI/2
): { x: number; y: number }[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = startAngle + (2 * Math.PI * i) / sides
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) }
  })
}

/** Parse a hex color to [r, g, b] */
export function hexToRgbArr(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}
