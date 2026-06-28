import { getFabric } from './fabricManager.js'

/**
 * Map a layer blendMode name to the CSS compositing keyword understood by
 * Fabric.js / the Canvas 2D API.
 * @param {string} mode
 * @returns {string}
 */
function blendModeToCSS(mode) {
  const map = {
    normal: 'source-over',
    multiply: 'multiply',
    screen: 'screen',
    overlay: 'overlay',
    darken: 'darken',
    lighten: 'lighten',
    'color-dodge': 'color-dodge',
    'color-burn': 'color-burn',
    'hard-light': 'hard-light',
    'soft-light': 'soft-light',
    difference: 'difference',
    exclusion: 'exclusion',
    hue: 'hue',
    saturation: 'saturation',
    color: 'color',
    luminosity: 'luminosity',
  }
  return map[mode] ?? 'source-over'
}

/**
 * Synchronise Fabric canvas objects with the current layers array from the
 * Zustand store.
 *
 * For each Fabric object whose `layerId` matches a layer entry:
 *   – visibility, opacity and composite operation are applied.
 *
 * Objects are then reordered on the canvas so that layer[0] is at the bottom
 * and layer[N-1] is at the top (Fabric stacking order: index 0 = back).
 *
 * @param {Array<{id:string,visible:boolean,opacity:number,blendMode:string}>} layers
 * @param {string|null} activeLayerId  (reserved for future active-layer highlighting)
 */
export function syncLayers(layers, activeLayerId) {
  const fc = getFabric()
  if (!fc) return

  const objects = fc.getObjects()

  // Build a quick lookup: layerId -> layer
  const layerMap = new Map(layers.map((l) => [l.id, l]))

  // Apply per-layer properties to every matching object
  for (const obj of objects) {
    const layer = layerMap.get(obj.layerId)
    if (!layer) continue

    obj.visible = layer.visible
    obj.opacity = layer.opacity
    obj.globalCompositeOperation = blendModeToCSS(layer.blendMode)
  }

  // Reorder objects to match the layer stack.
  // layers[0] = bottom → Fabric index 0; layers[N-1] = top → highest index.
  // We collect groups of objects per layer in layer order, then move them.
  const reordered = []
  for (const layer of layers) {
    const layerObjs = objects.filter((o) => o.layerId === layer.id)
    reordered.push(...layerObjs)
  }

  // Objects without a layerId stay at the top (unmanaged)
  const unmanaged = objects.filter((o) => !o.layerId)
  reordered.push(...unmanaged)

  // Apply the new order using the public moveObjectTo API to avoid touching
  // Fabric's private internals and breaking internal bookkeeping.
  if (reordered.length === objects.length) {
    reordered.forEach((obj, index) => {
      fc.moveObjectTo(obj, index)
    })
  }

  fc.renderAll()
}
