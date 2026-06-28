/**
 * All available filter preset names.
 * @type {string[]}
 */
export const FILTER_NAMES = ['grayscale', 'sepia', 'invert', 'vintage', 'vignette']

/**
 * Returns true for filters that are implemented as Fabric.js pixel filters
 * inside adjustmentEngine.js.  Returns false for filters that are rendered
 * via CSS/DOM overlays (e.g. vignette).
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isPixelFilter(name) {
  const pixelFilters = new Set(['grayscale', 'sepia', 'invert', 'vintage'])
  return pixelFilters.has(name)
}

/**
 * CSS value for a vignette overlay element.
 * Apply this as the `background` style on an absolutely-positioned <div>
 * that covers the canvas and has pointer-events: none.
 *
 * @type {string}
 */
export const VIGNETTE_STYLE =
  'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%)'
