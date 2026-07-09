import { getFabric, CANVAS_PAD } from './fabricManager.js'
import { getLowerCanvasEl } from '../utils/canvasOps.js'

/** Clip the Fabric lower-canvas to the image area (stripping CANVAS_PAD on each side). */
function clippedImageCanvas(lowerEl: HTMLCanvasElement, fc: any): HTMLCanvasElement {
  const imgW = fc.width  - 2 * CANVAS_PAD
  const imgH = fc.height - 2 * CANVAS_PAD
  const off = document.createElement('canvas')
  off.width = imgW; off.height = imgH
  off.getContext('2d')!.drawImage(lowerEl, CANVAS_PAD, CANVAS_PAD, imgW, imgH, 0, 0, imgW, imgH)
  return off
}

/** Temporarily hide all selection-overlay objects, run `fn`, then restore. */
function withoutSelectionOverlay<T>(fc: any, fn: () => T): T {
  const overlays = (fc.getObjects() as any[]).filter(o => o.layerId === 'selection')
  overlays.forEach(o => { o.visible = false })
  fc.renderAll()
  try {
    return fn()
  } finally {
    overlays.forEach(o => { o.visible = true })
    fc.renderAll()
  }
}

/**
 * Download the current canvas as an image file.
 *
 * @param {'png'|'jpeg'|'webp'} format   Image format (default 'png').
 * @param {number}              quality  Quality 0–100 for lossy formats (default 92).
 * @param {string}              fileName Base file name without extension (default 'export').
 */
export function downloadImage(format = 'png', quality = 92, fileName = 'export') {
  const fc = getFabric()
  if (!fc) throw new Error('Fabric canvas is not initialised.')

  const dataURL = withoutSelectionOverlay(fc, () => {
    // Re-render so overlay objects are hidden, then read only the image area
    const lowerEl = getLowerCanvasEl()
    if (!lowerEl) return ''
    return clippedImageCanvas(lowerEl, fc).toDataURL(
      format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png',
      quality / 100
    )
  })

  const ext = format === 'jpeg' ? 'jpg' : format
  // Sanitize fileName: allow only alphanumerics, hyphens, underscores, and dots
  const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')
  const a = document.createElement('a')
  a.href = dataURL
  a.download = `${safeName}.${ext}`
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Copy the current canvas contents to the system clipboard as a PNG blob.
 *
 * Requires the Clipboard API and ClipboardItem to be available (modern browsers
 * with HTTPS or localhost).
 *
 * @returns {Promise<void>}
 */
export function copyToClipboard() {
  const fc = getFabric()
  if (!fc) return Promise.reject(new Error('Fabric canvas is not initialised.'))

  if (!navigator.clipboard?.write) {
    return Promise.reject(
      new Error('Clipboard API is not available in this browser/context.')
    )
  }

  return new Promise((resolve, reject) => {
    // Hide selection overlay, capture blob, then restore
    const overlays = (fc.getObjects() as any[]).filter(o => o.layerId === 'selection')
    overlays.forEach(o => { o.visible = false })
    fc.renderAll()

    const lowerEl = getLowerCanvasEl()
    if (!lowerEl) { reject(new Error('Canvas not available.')); return }
    clippedImageCanvas(lowerEl, fc).toBlob((blob) => {
      overlays.forEach(o => { o.visible = true })
      fc.renderAll()

      if (!blob) {
        reject(new Error('Failed to create blob from canvas.'))
        return
      }

      navigator.clipboard
        .write([new ClipboardItem({ 'image/png': blob })])
        .then(resolve)
        .catch(reject)
    }, 'image/png')
  })
}
