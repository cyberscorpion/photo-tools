import { getFabric } from './fabricManager.js'
import { FabricImage } from 'fabric'

// ─── MARCHING SQUARES TABLE ──────────────────────────────────────────────────
// Bit encoding: TL=8, TR=4, BR=2, BL=1
// Entries: [[x1,y1, x2,y2], ...] in unit-cell coords [0..1]
const MS_TABLE = [
  [],                                              // 0  (0000)
  [[0, 0.5, 0.5, 1]],                             // 1  BL
  [[0.5, 1, 1, 0.5]],                             // 2  BR
  [[0, 0.5, 1, 0.5]],                             // 3  BL+BR
  [[0.5, 0, 1, 0.5]],                             // 4  TR
  [[0, 0.5, 0.5, 0], [0.5, 1, 1, 0.5]],          // 5  TR+BL saddle
  [[0.5, 0, 0.5, 1]],                             // 6  TR+BR
  [[0, 0.5, 0.5, 0]],                             // 7  TR+BR+BL
  [[0.5, 0, 0, 0.5]],                             // 8  TL
  [[0.5, 0, 0.5, 1]],                             // 9  TL+BL
  [[0.5, 0, 1, 0.5], [0, 0.5, 0.5, 1]],          // 10 TL+BR saddle
  [[0.5, 0, 1, 0.5]],                             // 11 TL+BR+BL
  [[0, 0.5, 1, 0.5]],                             // 12 TL+TR
  [[0.5, 1, 1, 0.5]],                             // 13 TL+TR+BL
  [[0, 0.5, 0.5, 1]],                             // 14 TL+TR+BR
  [],                                              // 15 (1111)
]

// ─── BOX DILATION (O(w·h) sliding window) ────────────────────────────────────
// Separable horizontal + vertical pass → Chebyshev (square) dilation.
function dilateMask(mask, w, h, radius) {
  if (radius <= 0) return new Uint8Array(mask)
  const r = Math.round(radius)
  const temp = new Uint8Array(w * h)

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    let win = 0
    const base = y * w
    for (let x = 0; x <= Math.min(r, w - 1); x++) if (mask[base + x]) win++
    temp[base] = win > 0 ? 1 : 0
    for (let x = 1; x < w; x++) {
      const leave = x - r - 1
      if (leave >= 0 && mask[base + leave]) win--
      const enter = x + r
      if (enter < w && mask[base + enter]) win++
      temp[base + x] = win > 0 ? 1 : 0
    }
  }

  // Vertical pass
  const result = new Uint8Array(w * h)
  for (let x = 0; x < w; x++) {
    let win = 0
    for (let y = 0; y <= Math.min(r, h - 1); y++) if (temp[y * w + x]) win++
    result[x] = win > 0 ? 1 : 0
    for (let y = 1; y < h; y++) {
      const leave = y - r - 1
      if (leave >= 0 && temp[leave * w + x]) win--
      const enter = y + r
      if (enter < h && temp[enter * w + x]) win++
      result[y * w + x] = win > 0 ? 1 : 0
    }
  }

  return result
}

// ─── SMOOTH CORNERS ──────────────────────────────────────────────────────────
// Apply a Gaussian blur to the binary mask then re-threshold at 50%.
// The blur rounds sharp (box-dilation) corners into quarter-circles without
// shrinking the straight edges (50% of a hard edge is still at the edge).
// smoothness 0–100 → blurRadius 0–20 px.
function smoothMaskCorners(mask, w, h, smoothness) {
  if (smoothness <= 0) return mask
  const blurPx = (smoothness / 100) * 20  // 0–20 px

  const src = createCanvas(w, h)
  const sCtx = src.getContext('2d')
  const imgData = new ImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    const v = mask[i] ? 255 : 0
    imgData.data[i * 4] = v
    imgData.data[i * 4 + 1] = v
    imgData.data[i * 4 + 2] = v
    imgData.data[i * 4 + 3] = v
  }
  sCtx.putImageData(imgData, 0, 0)

  const dst = createCanvas(w, h)
  const dCtx = dst.getContext('2d')
  dCtx.filter = `blur(${blurPx.toFixed(1)}px)`
  dCtx.drawImage(src, 0, 0)
  dCtx.filter = 'none'

  const blurred = dCtx.getImageData(0, 0, w, h)
  const result = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    // 50% threshold: straight edges hold their position, corners round inward
    result[i] = blurred.data[i * 4 + 3] >= 128 ? 1 : 0
  }
  return result
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function createCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

async function blobToDataURL(blob) {
  return new Promise((res) => {
    const reader = new FileReader()
    reader.onload = (e) => res(e.target.result)
    reader.readAsDataURL(blob)
  })
}

function getBaseImageElement() {
  const fc = getFabric()
  if (!fc) return null
  const obj = fc.getObjects().find(
    (o) => (o.type === 'image' || o.constructor?.name === 'FabricImage') && o.layerId !== 'contour'
  )
  return obj ? (obj._element || obj.getElement?.()) : null
}

function extractAlphaMask(data, w, h, threshold = 127) {
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) mask[i] = data[i * 4 + 3] > threshold ? 1 : 0
  return mask
}

function getImagePixels(el) {
  const w = el.naturalWidth || el.width
  const h = el.naturalHeight || el.height
  const c = createCanvas(w, h)
  c.getContext('2d').drawImage(el, 0, 0)
  return { data: c.getContext('2d').getImageData(0, 0, w, h).data, w, h }
}

// ─── CORE CONTOUR COMPUTATION ────────────────────────────────────────────────
// offset    – gap (px) between image edge and where the contour starts
// thickness – width (px) of the contour band
// smoothness – 0–100, rounds corners of the outer boundary
function computeContourMasks(mask, w, h, offset, thickness, smoothness) {
  const safeOffset    = Math.max(0, Math.round(offset))
  const safeThickness = Math.max(1, Math.round(thickness))

  // Both inner and outer are dilated first, then smoothed with the same
  // parameters so their corners round identically — keeping band width uniform.
  let inner = dilateMask(mask, w, h, safeOffset)
  let outer = dilateMask(mask, w, h, safeOffset + safeThickness)

  if (smoothness > 0) {
    inner = smoothMaskCorners(inner, w, h, smoothness)
    outer = smoothMaskCorners(outer, w, h, smoothness)
  }

  return { inner, outer }
}

function buildContourImageData(inner, outer, w, h, color, opacity) {
  const [r, g, b] = hexToRgb(color)
  const a = Math.round(255 * opacity)
  const buf = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    if (outer[i] && !inner[i]) {
      buf[i * 4]     = r
      buf[i * 4 + 1] = g
      buf[i * 4 + 2] = b
      buf[i * 4 + 3] = a
    }
  }
  return new ImageData(buf, w, h)
}

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

/**
 * Render the contour on the Fabric canvas as an image layer.
 * @param {number} offset      – gap between image edge and contour (px)
 * @param {number} thickness   – width of contour band (px)
 * @param {string} color       – hex color e.g. '#ff0000'
 * @param {number} opacity     – 0–1
 * @param {number} smoothness  – 0–100 corner smoothness
 */
export async function renderContour(offset, thickness, color, opacity = 1, smoothness = 0) {
  const el = getBaseImageElement()
  if (!el) return null

  const { data, w, h } = getImagePixels(el)
  const mask = extractAlphaMask(data, w, h)
  const { inner, outer } = computeContourMasks(mask, w, h, offset, thickness, smoothness)
  const iData = buildContourImageData(inner, outer, w, h, color, opacity)

  const c = createCanvas(w, h)
  c.getContext('2d').putImageData(iData, 0, 0)
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'))
  const dataURL = await blobToDataURL(blob)

  removeContourFromCanvas()

  const fc = getFabric()
  if (!fc) return null

  const fabImg = await FabricImage.fromURL(dataURL, { crossOrigin: 'anonymous' })
  fabImg.set({ left: 0, top: 0, selectable: false, evented: false, layerId: 'contour', customId: 'contour-layer' })
  fc.add(fabImg)

  // Place contour behind the base image
  const baseImg = fc.getObjects().find((o) => o.layerId === 'background' || (o.layerId !== 'contour' && o.type === 'image'))
  if (baseImg) fc.sendObjectBackwards(fabImg)

  fc.renderAll()
  return dataURL
}

/** Remove the contour Fabric Image layer from the canvas. */
export function removeContourFromCanvas() {
  const fc = getFabric()
  if (!fc) return
  const existing = fc.getObjects().filter((o) => o.layerId === 'contour')
  existing.forEach((o) => fc.remove(o))
  if (existing.length) fc.renderAll()
}

/** Export contour as a transparent PNG (contour pixels only). */
export async function exportContourAsPNG(offset, thickness, color, smoothness = 0, fileName = 'contour') {
  const el = getBaseImageElement()
  if (!el) return
  const { data, w, h } = getImagePixels(el)
  const mask = extractAlphaMask(data, w, h)
  const { inner, outer } = computeContourMasks(mask, w, h, offset, thickness, smoothness)
  const iData = buildContourImageData(inner, outer, w, h, color, 1)

  const c = createCanvas(w, h)
  c.getContext('2d').putImageData(iData, 0, 0)
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName.replace(/\.[^.]+$/, '')}-contour.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Export the outer contour boundary as an SVG path file. */
export async function exportContourAsSVG(offset, thickness, color, smoothness = 0, fileName = 'contour') {
  const el = getBaseImageElement()
  if (!el) return
  const { data, w, h } = getImagePixels(el)
  const mask = extractAlphaMask(data, w, h)
  const { outer } = computeContourMasks(mask, w, h, offset, thickness, smoothness)

  // Trace outer boundary with marching squares
  const pathD = marchingSquaresToSVG(outer, w, h)

  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
    `  <path d="${pathD}" fill="${color}" fill-rule="evenodd" />`,
    `</svg>`,
  ].join('\n')

  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName.replace(/\.[^.]+$/, '')}-contour.svg`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// ─── MARCHING SQUARES ────────────────────────────────────────────────────────
function marchingSquaresToSVG(mask, w, h) {
  const rawSegs = []
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const tl = mask[y * w + x]
      const tr = mask[y * w + (x + 1)]
      const br = mask[(y + 1) * w + (x + 1)]
      const bl = mask[(y + 1) * w + x]
      const code = (tl << 3) | (tr << 2) | (br << 1) | bl
      for (const [dx1, dy1, dx2, dy2] of MS_TABLE[code]) {
        rawSegs.push([x + dx1, y + dy1, x + dx2, y + dy2])
      }
    }
  }
  if (rawSegs.length === 0) return ''

  const pt = (x, y) => `${x},${y}`
  const adj = new Map()
  rawSegs.forEach(([x1, y1, x2, y2], i) => {
    const k1 = pt(x1, y1), k2 = pt(x2, y2)
    if (!adj.has(k1)) adj.set(k1, [])
    if (!adj.has(k2)) adj.set(k2, [])
    adj.get(k1).push({ x: x2, y: y2, seg: i })
    adj.get(k2).push({ x: x1, y: y1, seg: i })
  })

  const usedSegs = new Uint8Array(rawSegs.length)
  const paths = []

  for (let i = 0; i < rawSegs.length; i++) {
    if (usedSegs[i]) continue
    usedSegs[i] = 1
    const [sx1, sy1, sx2, sy2] = rawSegs[i]
    const pts = [{ x: sx1, y: sy1 }, { x: sx2, y: sy2 }]
    let cur = { x: sx2, y: sy2 }

    for (let iter = 0; iter < rawSegs.length * 2; iter++) {
      const k = pt(cur.x, cur.y)
      const next = (adj.get(k) || []).find((n) => !usedSegs[n.seg])
      if (!next) break
      usedSegs[next.seg] = 1
      cur = { x: next.x, y: next.y }
      if (cur.x === pts[0].x && cur.y === pts[0].y) break
      pts.push(cur)
    }

    if (pts.length < 3) continue
    const simplified = rdp(pts, 0.5)
    paths.push(
      `M ${simplified[0].x} ${simplified[0].y}` +
        simplified.slice(1).map((p) => ` L ${p.x} ${p.y}`).join('') +
        ' Z'
    )
  }

  return paths.join(' ')
}

function rdp(pts, eps) {
  if (pts.length <= 2) return pts
  let maxDist = 0, maxIdx = 0
  const last = pts[pts.length - 1]
  for (let i = 1; i < pts.length - 1; i++) {
    const d = pointToLineDist(pts[i], pts[0], last)
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }
  if (maxDist > eps) {
    const left = rdp(pts.slice(0, maxIdx + 1), eps)
    const right = rdp(pts.slice(maxIdx), eps)
    return [...left.slice(0, -1), ...right]
  }
  return [pts[0], last]
}

function pointToLineDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
