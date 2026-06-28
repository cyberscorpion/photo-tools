/**
 * Parse a CSS hex colour string (#rgb, #rrggbb, #rrggbbaa) into an
 * { r, g, b, a } object where each component is 0–255 (a defaults to 255).
 *
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number, a: number }|null}
 */
export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null

  const clean = hex.replace(/^#/, '')

  let r, g, b, a = 255

  if (clean.length === 3 || clean.length === 4) {
    r = parseInt(clean[0] + clean[0], 16)
    g = parseInt(clean[1] + clean[1], 16)
    b = parseInt(clean[2] + clean[2], 16)
    if (clean.length === 4) a = parseInt(clean[3] + clean[3], 16)
  } else if (clean.length === 6 || clean.length === 8) {
    r = parseInt(clean.slice(0, 2), 16)
    g = parseInt(clean.slice(2, 4), 16)
    b = parseInt(clean.slice(4, 6), 16)
    if (clean.length === 8) a = parseInt(clean.slice(6, 8), 16)
  } else {
    return null
  }

  if ([r, g, b, a].some(isNaN)) return null

  return { r, g, b, a }
}

/**
 * Convert individual R, G, B components (0–255) to a lowercase CSS hex string
 * like '#aabbcc'.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
export function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  )
}

/**
 * Sample the colour of a single pixel on the Fabric lower canvas and return it
 * as a hex string.
 *
 * @param {import('fabric').Canvas} fc  The Fabric canvas instance.
 * @param {number} x  Canvas x coordinate (pre-transform, i.e. in CSS pixels).
 * @param {number} y  Canvas y coordinate.
 * @returns {string}  Hex colour e.g. '#ff0080', or '#000000' on failure.
 */
export function getPixelColor(fc, x, y) {
  try {
    // fc.getElement() returns the lower (rendering) canvas element
    const ctx =
      fc.getContext?.('2d') ??
      fc.lowerCanvasEl?.getContext('2d') ??
      fc.getElement?.()?.getContext('2d')

    if (!ctx) return '#000000'

    const data = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data
    return rgbToHex(data[0], data[1], data[2])
  } catch (_) {
    return '#000000'
  }
}
