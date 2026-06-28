import { filters } from 'fabric'
import { getFabric } from './fabricManager.js'

/**
 * Build a warmth ColorMatrix.
 * Shifts the image warmer by boosting red/green and reducing blue.
 * val is in the range [-100, 100].
 * @param {number} val
 * @returns {filters.ColorMatrix}
 */
function makeWarmthFilter(val) {
  const t = val / 100 // -1 … +1
  // prettier-ignore
  const matrix = [
    1 + t * 0.2, 0,           0,            0, 0,
    0,           1 + t * 0.1, 0,            0, 0,
    0,           0,           1 - t * 0.2,  0, 0,
    0,           0,           0,            1, 0,
  ]
  return new filters.ColorMatrix({ matrix })
}

/**
 * Apply the current adjustments and active filter presets to a FabricImage.
 *
 * @param {import('fabric').FabricImage} imgObject  The base image layer object.
 * @param {Object} adjustments  Key/value map matching the store's adjustments shape.
 * @param {string[]} activeFilters  Names of toggled preset filters (e.g. 'grayscale').
 */
export function applyAdjustments(imgObject, adjustments, activeFilters) {
  if (!imgObject) return

  const fc = getFabric()
  const filterList = []

  const {
    brightness = 0,
    contrast = 0,
    saturation = 0,
    hue = 0,
    exposure = 0,
    warmth = 0,
    blur = 0,
    sharpness = 0,
    tint = 0,
    shadows = 0,
    highlights = 0,
  } = adjustments

  // ── Per-slider filters ───────────────────────────────────────────────────────

  if (brightness !== 0) {
    filterList.push(new filters.Brightness({ brightness: brightness / 100 }))
  }

  if (contrast !== 0) {
    filterList.push(new filters.Contrast({ contrast: contrast / 100 }))
  }

  if (saturation !== 0) {
    filterList.push(new filters.Saturation({ saturation: saturation / 100 }))
  }

  if (hue !== 0) {
    filterList.push(
      new filters.HueRotation({ rotation: (hue / 180) * Math.PI })
    )
  }

  if (blur > 0) {
    filterList.push(new filters.Blur({ blur: blur / 200 }))
  }

  if (sharpness > 0) {
    // Canonical 3x3 unsharp mask: kernel always sums to 1.0 regardless of sharpness value
    const s = sharpness / 400
    // prettier-ignore
    filterList.push(
      new filters.Convolute({
        matrix: [
          -s,       -s,       -s,
          -s,  1 + 8*s,       -s,
          -s,       -s,       -s,
        ],
      })
    )
  }

  if (exposure !== 0) {
    const mult = Math.pow(2, exposure / 50)
    filterList.push(new filters.Gamma({ gamma: [mult, mult, mult] }))
  }

  if (warmth !== 0) {
    filterList.push(makeWarmthFilter(warmth))
  }

  // Tint: negative = green shift, positive = magenta shift (reduce green channel)
  if (tint !== 0) {
    const t = tint / 300
    // prettier-ignore
    filterList.push(new filters.ColorMatrix({
      matrix: [
        1, 0, 0, 0, 0,
        0, 1 - t, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, 0, 1, 0,
      ],
    }))
  }

  // Shadows: non-linear gamma that boosts/darkens shadow tones
  // Use a power-curve via Gamma: shadows +100 lifts darks, -100 crushes them
  if (shadows !== 0) {
    const gamma = Math.pow(2, -shadows / 200)
    filterList.push(new filters.Gamma({ gamma: [gamma, gamma, gamma] }))
  }

  // Highlights: similar but targets bright tones via inverted curve
  if (highlights !== 0) {
    const gamma = Math.pow(2, highlights / 300)
    filterList.push(new filters.Gamma({ gamma: [gamma, gamma, gamma] }))
  }

  // ── Preset / named filters ───────────────────────────────────────────────────

  for (const name of activeFilters) {
    switch (name) {
      case 'grayscale':
        filterList.push(new filters.Grayscale())
        break

      case 'sepia':
        filterList.push(new filters.Sepia())
        break

      case 'invert':
        filterList.push(new filters.Invert())
        break

      case 'vintage':
        // prettier-ignore
        filterList.push(
          new filters.ColorMatrix({
            matrix: [
              0.9, 0.1, 0,   0, 0,
              0.2, 0.8, 0.1, 0, 0,
              0.1, 0.1, 0.7, 0, 0,
              0,   0,   0,   1, 0,
            ],
          })
        )
        break

      // 'vignette' is a CSS overlay handled in the UI, not a Fabric filter
      default:
        break
    }
  }

  imgObject.filters = filterList
  imgObject.applyFilters()

  if (fc) {
    fc.renderAll()
  }
}
