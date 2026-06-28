import { getFabric } from './fabricManager.js'
import { FabricImage } from 'fabric'
import { useEditorStore } from '../store/editorStore.js'

// ─── EXACT EUCLIDEAN DISTANCE TRANSFORM (O(w·h)) ────────────────────────────
// Lower-envelope parabola method (Felzenszwalb & Huttenlocher, 2012).
// f[i] = squared source-distance at position i (0 for fg, large INF for bg).
// Returns squared Euclidean distances to nearest foreground position.
function edt1D(f, n) {
  const d = new Float32Array(n)
  const z = new Float32Array(n + 1)
  const v = new Int32Array(n)
  let k = 0
  v[0] = 0; z[0] = -1e30; z[1] = 1e30
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e30
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
  }
  return d
}

// 2D exact EDT via two separable 1D passes.
// Returns Float32Array of Euclidean distances; mask=1 pixels get 0.
function edt2D(mask, w, h) {
  const INF = 1e10
  const g   = new Float32Array(w * h)
  const col = new Float32Array(h)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) col[y] = mask[y * w + x] ? 0 : INF
    const d = edt1D(col, h)
    for (let y = 0; y < h; y++) g[y * w + x] = d[y]
  }
  const result = new Float32Array(w * h)
  const row   = new Float32Array(w)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) row[x] = g[y * w + x]
    const d = edt1D(row, w)
    for (let x = 0; x < w; x++) result[y * w + x] = Math.sqrt(d[x])
  }
  return result
}

// ─── CORNER ROUNDING ─────────────────────────────────────────────────────────
// Apply Gaussian blur + 50% rethreshold to the source mask.
// This rounds convex corners into smooth arcs and fills concave notches
// proportional to `cornerRadius` px — straight edges stay at their exact position
// because a hard edge blurred at 50% lands exactly on the original boundary.
// The result is then used as the EDT source so the contour path inherits the
// rounded geometry; the ORIGINAL (unrounded) mask is kept separately to
// ensure no image pixels get painted over.
function roundMaskCorners(mask, w, h, cornerRadius) {
  if (cornerRadius <= 0) return mask

  const blurPx = cornerRadius * 0.5   // empirically: blur σ ≈ r/2 for 50% threshold

  const src  = createCanvas(w, h)
  const sCtx = src.getContext('2d')
  const imgData = new ImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    const v = mask[i] ? 255 : 0
    imgData.data[i * 4]     = v
    imgData.data[i * 4 + 1] = v
    imgData.data[i * 4 + 2] = v
    imgData.data[i * 4 + 3] = v
  }
  sCtx.putImageData(imgData, 0, 0)

  const dst  = createCanvas(w, h)
  const dCtx = dst.getContext('2d')
  dCtx.filter = `blur(${blurPx.toFixed(1)}px)`
  dCtx.drawImage(src, 0, 0)
  dCtx.filter = 'none'

  const blurred = dCtx.getImageData(0, 0, w, h)
  const result  = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    result[i] = blurred.data[i * 4 + 3] >= 128 ? 1 : 0
  }
  return result
}

// ─── MARCHING SQUARES TABLE ──────────────────────────────────────────────────
const MS_TABLE = [
  [], [[0,.5,.5,1]], [[.5,1,1,.5]], [[0,.5,1,.5]],
  [[.5,0,1,.5]], [[0,.5,.5,0],[.5,1,1,.5]], [[.5,0,.5,1]], [[0,.5,.5,0]],
  [[.5,0,0,.5]], [[.5,0,.5,1]], [[.5,0,1,.5],[0,.5,.5,1]], [[.5,0,1,.5]],
  [[0,.5,1,.5]], [[.5,1,1,.5]], [[0,.5,.5,1]], [],
]

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

function createCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return c
}

async function blobToDataURL(blob) {
  return new Promise(res => {
    const r = new FileReader()
    r.onload = e => res(e.target.result)
    r.readAsDataURL(blob)
  })
}

// Safe download: appends anchor to DOM so the browser can't block it,
// and revokes the URL after 60 s to give the browser ample time to finish.
function triggerDownload(url, fileName) {
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function getBaseImageObject() {
  const fc = getFabric()
  if (!fc) return null
  return fc.getObjects().find(
    o => (o.type === 'image' || o.constructor?.name === 'FabricImage') && o.layerId !== 'contour'
  ) || null
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

// ─── CANVAS EXPANSION ────────────────────────────────────────────────────────
// Resize the Fabric canvas so there is at least `pad` pixels of clear space
// around the base image on every side.  All non-contour objects move together
// so their positions relative to the image are preserved.
// Returns the base image's new { left, top } after the resize.
function ensureCanvasPadding(fc, imgObj, imgW, imgH, pad) {
  const currentLeft = imgObj.left || 0
  const currentTop  = imgObj.top  || 0

  const targetLeft = pad
  const targetTop  = pad
  const targetW    = imgW + pad * 2
  const targetH    = imgH + pad * 2

  const dx = targetLeft - currentLeft
  const dy = targetTop  - currentTop

  // Move every non-contour object by the same delta so relative positions hold
  fc.getObjects().forEach(obj => {
    if (obj.layerId !== 'contour') {
      obj.set({ left: (obj.left || 0) + dx, top: (obj.top || 0) + dy })
    }
  })

  if (fc.width !== targetW || fc.height !== targetH) {
    fc.setWidth(targetW)
    fc.setHeight(targetH)
  }

  return { left: targetLeft, top: targetTop }
}

// ─── CONTOUR RGBA BUILDER ────────────────────────────────────────────────────
// exclusionMask – padded ORIGINAL mask: pixels here are inside the image, skip.
// dt            – EDT computed from the ROUNDED mask: drives contour position.
// Hard edges everywhere — corners are already rounded via roundMaskCorners().
function buildContourImageData(exclusionMask, dt, PW, PH, offset, thickness, color, opacity) {
  const [r, g, b] = hexToRgb(color)
  const a          = Math.round(255 * opacity)
  const inner      = Math.max(0, offset)
  const outer      = offset + thickness
  const buf        = new Uint8ClampedArray(PW * PH * 4)

  for (let i = 0; i < PW * PH; i++) {
    if (exclusionMask[i]) continue        // inside original image — never paint
    const d = dt[i]
    if (d < inner || d >= outer) continue // outside contour band

    buf[i * 4]     = r
    buf[i * 4 + 1] = g
    buf[i * 4 + 2] = b
    buf[i * 4 + 3] = a
  }
  return new ImageData(buf, PW, PH)
}

// ─── BUILD PADDED MASK ───────────────────────────────────────────────────────
function buildPaddedMask(mask, w, h, pad) {
  const PW = w + pad * 2
  const PH = h + pad * 2
  const paddedMask = new Uint8Array(PW * PH)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      paddedMask[(y + pad) * PW + (x + pad)] = mask[y * w + x]
    }
  }
  return { paddedMask, PW, PH }
}

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

export async function renderContour(offset, thickness, color, opacity = 1, smoothness = 0) {
  const imgObj = getBaseImageObject()
  if (!imgObj) return null
  const el = imgObj._element || imgObj.getElement?.()
  if (!el) return null

  const { data, w, h } = getImagePixels(el)
  const originalMask = extractAlphaMask(data, w, h)
  const pad          = Math.ceil(offset + thickness)

  // ── 1. Expand canvas so contour has room on all sides ──────────────────────
  const fc = getFabric()
  if (!fc) return null
  const { left: imgLeft, top: imgTop } = ensureCanvasPadding(fc, imgObj, w, h, pad)

  // ── 2. Round corners of source shape, then build padded masks & EDT ────────
  // cornerRadius: smoothness 0-100 → 0-40 px arc radius on corners
  const cornerRadius  = (smoothness / 100) * 40
  const roundedMask   = roundMaskCorners(originalMask, w, h, cornerRadius)
  const { paddedMask: paddedRounded,  PW, PH } = buildPaddedMask(roundedMask,   w, h, pad)
  const { paddedMask: paddedOriginal }          = buildPaddedMask(originalMask,  w, h, pad)
  const dt    = edt2D(paddedRounded, PW, PH)
  const iData = buildContourImageData(paddedOriginal, dt, PW, PH, offset, thickness, color, opacity)

  // ── 3. Convert to image ────────────────────────────────────────────────────
  const c = createCanvas(PW, PH)
  c.getContext('2d').putImageData(iData, 0, 0)
  const blob    = await new Promise(res => c.toBlob(res, 'image/png'))
  const dataURL = await blobToDataURL(blob)

  // ── 4. Remove old contour, add new one ────────────────────────────────────
  removeContourFromCanvas(true)    // true = skip canvas-restore; we just expanded it above

  const fabImg = await FabricImage.fromURL(dataURL, { crossOrigin: 'anonymous' })
  // Contour image starts at (imgLeft - pad, imgTop - pad) = (0, 0) in the expanded canvas
  fabImg.set({
    left: imgLeft - pad,
    top:  imgTop  - pad,
    selectable: false,
    evented:    false,
    layerId:    'contour',
    customId:   'contour-layer',
  })
  fc.add(fabImg)

  // Keep contour behind the base image
  const base = fc.getObjects().find(o => o.layerId !== 'contour' && (o.type === 'image' || o.constructor?.name === 'FabricImage'))
  if (base) fc.sendObjectBackwards(fabImg)

  fc.renderAll()
  return dataURL
}

// skipRestore=true when called internally (e.g. from renderContour before re-adding)
export function removeContourFromCanvas(skipRestore = false) {
  const fc = getFabric()
  if (!fc) return

  const existing = fc.getObjects().filter(o => o.layerId === 'contour')
  existing.forEach(o => fc.remove(o))

  // Restore canvas to image size (no padding) so there's no empty buffer
  if (!skipRestore) {
    const { imageSize } = useEditorStore.getState()
    if (imageSize.w > 0 && imageSize.h > 0) {
      const imgObj = getBaseImageObject()
      if (imgObj) ensureCanvasPadding(fc, imgObj, imageSize.w, imageSize.h, 0)
    }
  }

  if (existing.length) fc.renderAll()
}

export async function exportContourAsPNG(offset, thickness, color, smoothness = 0, fileName = 'contour') {
  const imgObj = getBaseImageObject()
  if (!imgObj) return
  const el = imgObj._element || imgObj.getElement?.()
  if (!el) return

  const { data, w, h } = getImagePixels(el)
  const originalMask  = extractAlphaMask(data, w, h)
  const pad           = Math.ceil(offset + thickness)
  const cornerRadius  = (smoothness / 100) * 40
  const roundedMask   = roundMaskCorners(originalMask, w, h, cornerRadius)
  const { paddedMask: paddedRounded,  PW, PH } = buildPaddedMask(roundedMask,  w, h, pad)
  const { paddedMask: paddedOriginal }          = buildPaddedMask(originalMask, w, h, pad)
  const dt    = edt2D(paddedRounded, PW, PH)
  const iData = buildContourImageData(paddedOriginal, dt, PW, PH, offset, thickness, color, 1)

  const c = createCanvas(PW, PH)
  c.getContext('2d').putImageData(iData, 0, 0)
  const blob = await new Promise(res => c.toBlob(res, 'image/png'))
  const url  = URL.createObjectURL(blob)
  triggerDownload(url, `${fileName.replace(/\.[^.]+$/, '')}-contour.png`)
}

export async function exportContourAsSVG(offset, thickness, color, smoothness = 0, fileName = 'contour') {
  const imgObj = getBaseImageObject()
  if (!imgObj) return
  const el = imgObj._element || imgObj.getElement?.()
  if (!el) return

  const { data, w, h } = getImagePixels(el)
  const originalMask = extractAlphaMask(data, w, h)
  const pad          = Math.ceil(offset + thickness)
  const cornerRadius = (smoothness / 100) * 40
  const roundedMask  = roundMaskCorners(originalMask, w, h, cornerRadius)
  const { paddedMask, PW, PH } = buildPaddedMask(roundedMask, w, h, pad)
  const dt = edt2D(paddedMask, PW, PH)

  // Outer boundary: rounded shape + contour band — marching squares traces this perimeter
  const outerMask = new Uint8Array(PW * PH)
  for (let i = 0; i < PW * PH; i++) {
    outerMask[i] = (paddedMask[i] || dt[i] < offset + thickness) ? 1 : 0
  }

  const pathD = marchingSquaresToSVG(outerMask, PW, PH)
  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}" width="${PW}" height="${PH}">`,
    `  <path d="${pathD}" fill="${color}" fill-rule="evenodd" />`,
    `</svg>`,
  ].join('\n')

  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url  = URL.createObjectURL(blob)
  triggerDownload(url, `${fileName.replace(/\.[^.]+$/, '')}-contour.svg`)
}

// ─── MARCHING SQUARES ────────────────────────────────────────────────────────
function marchingSquaresToSVG(mask, w, h) {
  const rawSegs = []
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const code = (mask[y*w+x]<<3)|(mask[y*w+(x+1)]<<2)|(mask[(y+1)*w+(x+1)]<<1)|mask[(y+1)*w+x]
      for (const [dx1,dy1,dx2,dy2] of MS_TABLE[code]) rawSegs.push([x+dx1, y+dy1, x+dx2, y+dy2])
    }
  }
  if (!rawSegs.length) return ''

  const pt  = (x, y) => `${x},${y}`
  const adj = new Map()
  rawSegs.forEach(([x1,y1,x2,y2], i) => {
    const k1=pt(x1,y1), k2=pt(x2,y2)
    if (!adj.has(k1)) adj.set(k1,[])
    if (!adj.has(k2)) adj.set(k2,[])
    adj.get(k1).push({x:x2,y:y2,seg:i})
    adj.get(k2).push({x:x1,y:y1,seg:i})
  })

  const used = new Uint8Array(rawSegs.length)
  const paths = []

  for (let i = 0; i < rawSegs.length; i++) {
    if (used[i]) continue
    used[i] = 1
    const [sx1,sy1,sx2,sy2] = rawSegs[i]
    const pts = [{x:sx1,y:sy1},{x:sx2,y:sy2}]
    let cur = {x:sx2,y:sy2}
    for (let iter = 0; iter < rawSegs.length * 2; iter++) {
      const next = (adj.get(pt(cur.x,cur.y))||[]).find(n=>!used[n.seg])
      if (!next) break
      used[next.seg] = 1
      cur = {x:next.x,y:next.y}
      if (cur.x===pts[0].x && cur.y===pts[0].y) break
      pts.push(cur)
    }
    if (pts.length < 3) continue
    const s = rdp(pts, 0.5)
    paths.push(`M ${s[0].x} ${s[0].y}${s.slice(1).map(p=>` L ${p.x} ${p.y}`).join('')} Z`)
  }
  return paths.join(' ')
}

function rdp(pts, eps) {
  if (pts.length <= 2) return pts
  let maxD = 0, maxI = 0
  const last = pts[pts.length-1]
  for (let i = 1; i < pts.length-1; i++) {
    const d = ptLineDist(pts[i], pts[0], last)
    if (d > maxD) { maxD = d; maxI = i }
  }
  if (maxD > eps) return [...rdp(pts.slice(0,maxI+1),eps).slice(0,-1), ...rdp(pts.slice(maxI),eps)]
  return [pts[0], last]
}

function ptLineDist(p, a, b) {
  const dx=b.x-a.x, dy=b.y-a.y, len2=dx*dx+dy*dy
  if (!len2) return Math.hypot(p.x-a.x,p.y-a.y)
  const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/len2
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy))
}
