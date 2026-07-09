import { Canvas } from 'fabric'

/**
 * Extra pixel buffer added on every side of the Fabric canvas beyond the image
 * dimensions.  Handles/controls drawn by Fabric on the upper-canvas are clipped
 * at the canvas element's pixel boundary; this padding gives them space to render
 * even when the selection or crop rect sits flush against the image edge.
 * WorkspaceArea compensates with a matching CSS offset so the image appears at
 * the same visual position.  400px gives a comfortable range for expanding the
 * crop selection well outside the original image boundary.
 */
export const CANVAS_PAD = 400

/** @type {Canvas|null} */
let _canvas = null

/** @type {((eventName: string, data: any) => void)|null} */
let _bridge = null

/** Returns the activeLayerId from the store — set by CanvasStage on mount */
let _getActiveLayerId: (() => string | null) | null = null

/** Call this from CanvasStage to wire the active-layer getter */
export function setLayerIdGetter(fn: () => string | null) {
  _getActiveLayerId = fn
}

/**
 * When true the event bridge is silenced — object:modified and path:created
 * will NOT push to history. Use this to wrap internal operations (like
 * reloadCanvasAsImage, sendObjectToBack, etc.) so they don't create spurious
 * duplicate history entries on top of the explicit pushHistory calls.
 */
let _suppressBridge = false

export function setSuppressHistoryBridge(suppress: boolean) {
  _suppressBridge = suppress
}

export function isHistoryBridgeSuppressed() {
  return _suppressBridge
}

/**
 * Create and configure the Fabric.js canvas singleton.
 * @param {HTMLCanvasElement} canvasEl
 * @param {number} width
 * @param {number} height
 * @returns {Canvas}
 */
export function initFabric(canvasEl, width, height) {
  if (_canvas) {
    _canvas.dispose()
    _canvas = null
  }

  const fc = new Canvas(canvasEl, {
    width,
    height,
    preserveObjectStacking: true,
    selection: true,
  })

  // Tag every new object with a unique customId, and auto-assign activeLayerId
  // if the object doesn't already have a layerId set before being added.
  fc.on('object:added', (e) => {
    const obj = e.target as any
    if (!obj) return
    if (!obj.customId) obj.customId = crypto.randomUUID()
    // Don't override explicit system layerIds (contour, selection, crop-overlay)
    const systemIds = ['contour', 'selection', 'crop-overlay']
    if (!obj.layerId && _getActiveLayerId && !systemIds.includes(obj.layerId)) {
      const layerId = _getActiveLayerId()
      if (layerId) obj.layerId = layerId
    }
  })

  // Forward path:created events through the bridge (suppressed during internal ops)
  fc.on('path:created', (e) => {
    if (_bridge && !_suppressBridge) {
      _bridge('path:created', e)
    }
  })

  // Forward object:modified events through the bridge (suppressed during internal ops)
  fc.on('object:modified', (e) => {
    if (_bridge && !_suppressBridge) {
      _bridge('object:modified', e)
    }
  })

  // Forward object:moving events through the bridge
  fc.on('object:moving', (e) => {
    if (_bridge) {
      _bridge('object:moving', e)
    }
  })

  _canvas = fc

  // Elevate the upper canvas (which draws selection handles and crop controls)
  // above any HTML/SVG overlays (e.g. the crop fishbowl SVG at z-index 20).
  // Painting order within the canvas-wrapper stacking context becomes:
  //   lowerCanvas (z-index: auto) → SVG overlay (z-index: 20) → upperCanvas (z-index: 30)
  // so the image content is darkened by the SVG but handles always remain fully visible.
  const uc = (fc as any).upperCanvasEl
  if (uc instanceof HTMLCanvasElement) uc.style.zIndex = '30'

  return fc
}

/**
 * Return the current Fabric canvas instance, or null if not initialised.
 * @returns {Canvas|null}
 */
export function getFabric() {
  return _canvas
}

/**
 * Dispose and clear the Fabric canvas singleton.
 */
export function disposeFabric() {
  if (_canvas) {
    _canvas.dispose()
    _canvas = null
  }
  _bridge = null
}

/**
 * Register a callback that is invoked whenever a bridged Fabric event fires.
 * @param {(eventName: string, data: any) => void} callback
 */
export function setEventBridge(callback) {
  _bridge = typeof callback === 'function' ? callback : null
}
