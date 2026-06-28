import { getFabric } from './fabricManager.js'

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

  const dataURL = fc.toDataURL({
    format,
    quality: quality / 100,
    multiplier: 1,
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
    // Access the lower canvas element (the one that renders the scene)
    const canvasEl = fc.getElement()

    canvasEl.toBlob((blob) => {
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
