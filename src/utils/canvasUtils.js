import { getFabric } from '../canvas/fabricManager.js'

/**
 * Generate a small thumbnail from the current Fabric canvas content.
 *
 * Creates an off-screen <canvas>, draws the Fabric canvas's toDataURL output
 * into it at the target dimensions, and returns the resulting data URL.
 *
 * @param {import('fabric').Canvas} [fc]  Fabric canvas instance. Falls back to
 *   getFabric() when omitted.
 * @param {number} [width=60]   Thumbnail width in pixels.
 * @param {number} [height=60]  Thumbnail height in pixels.
 * @returns {string|null}  A PNG data URL, or null if the canvas is unavailable.
 */
export function generateThumbnail(fc, width = 60, height = 60) {
  const canvas = fc ?? getFabric()
  if (!canvas) return null

  // Get the full-size data URL from Fabric
  let srcDataURL
  try {
    srcDataURL = canvas.toDataURL({ format: 'png', multiplier: 1 })
  } catch (_) {
    return null
  }

  // Draw onto an off-screen canvas scaled to the thumbnail dimensions
  const offscreen = document.createElement('canvas')
  offscreen.width = width
  offscreen.height = height

  const ctx = offscreen.getContext('2d')
  if (!ctx) return null

  const img = new Image()
  img.src = srcDataURL

  // If the image is already decoded (data URL → synchronous in most engines)
  ctx.drawImage(img, 0, 0, width, height)

  return offscreen.toDataURL('image/png')
}

/**
 * Async variant of generateThumbnail that waits for the image to fully load
 * before drawing. Use this when the canvas contains cross-origin resources.
 *
 * @param {import('fabric').Canvas} [fc]
 * @param {number} [width=60]
 * @param {number} [height=60]
 * @returns {Promise<string|null>}
 */
export function generateThumbnailAsync(fc, width = 60, height = 60) {
  const canvas = fc ?? getFabric()
  if (!canvas) return Promise.resolve(null)

  let srcDataURL
  try {
    srcDataURL = canvas.toDataURL({ format: 'png', multiplier: 1 })
  } catch (_) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const offscreen = document.createElement('canvas')
    offscreen.width = width
    offscreen.height = height

    const ctx = offscreen.getContext('2d')
    if (!ctx) { resolve(null); return }

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height)
      resolve(offscreen.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = srcDataURL
  })
}
