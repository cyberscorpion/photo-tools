import { Canvas } from 'fabric'

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
