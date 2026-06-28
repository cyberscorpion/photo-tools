import { IText, Rect, Ellipse, Path, PencilBrush } from 'fabric'
import { getFabric } from './fabricManager.js'

// ── Internal state ────────────────────────────────────────────────────────────

/** Tool-specific disposer functions keyed by tool id. */
const _disposers = {}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPointer(fc, e) {
  return fc.getViewportPoint(e.e)
}

function removeDisposer(toolId) {
  if (_disposers[toolId]) {
    _disposers[toolId]()
    delete _disposers[toolId]
  }
}

function offAll(fc, events) {
  for (const [name, handler] of Object.entries(events)) {
    fc.off(name, handler)
  }
}

// ── Tool activators ──────────────────────────────────────────────────────────

function activateSelect(fc) {
  fc.isDrawingMode = false
  fc.selection = true
  fc.defaultCursor = 'default'
  fc.forEachObject((o) => { o.selectable = true; o.evented = true })
  return () => {}
}

function activateHand(fc) {
  fc.isDrawingMode = false
  fc.selection = false
  fc.defaultCursor = 'grab'
  fc.forEachObject((o) => { o.selectable = false; o.evented = false })

  let isPanning = false
  let lastPanPoint = { x: 0, y: 0 }

  const onMouseDown = (e) => {
    isPanning = true
    lastPanPoint = { x: e.e.clientX, y: e.e.clientY }
    fc.defaultCursor = 'grabbing'
  }

  const onMouseMove = (e) => {
    if (!isPanning) return
    const dx = e.e.clientX - lastPanPoint.x
    const dy = e.e.clientY - lastPanPoint.y
    lastPanPoint = { x: e.e.clientX, y: e.e.clientY }
    fc.relativePan({ x: dx, y: dy })
  }

  const onMouseUp = () => {
    isPanning = false
    fc.defaultCursor = 'grab'
  }

  fc.on('mouse:down', onMouseDown)
  fc.on('mouse:move', onMouseMove)
  fc.on('mouse:up', onMouseUp)

  return () => {
    isPanning = false
    offAll(fc, {
      'mouse:down': onMouseDown,
      'mouse:move': onMouseMove,
      'mouse:up': onMouseUp,
    })
  }
}

function activateZoom(fc) {
  fc.isDrawingMode = false
  fc.selection = false
  fc.defaultCursor = 'zoom-in'
  fc.forEachObject((o) => { o.selectable = false; o.evented = false })

  const onMouseDown = (e) => {
    const point = getPointer(fc, e)
    const delta = e.e.shiftKey ? -0.25 : 0.25
    const newZoom = Math.max(0.1, Math.min(20, fc.getZoom() + delta))
    fc.zoomToPoint({ x: point.x, y: point.y }, newZoom)
    fc.defaultCursor = e.e.shiftKey ? 'zoom-out' : 'zoom-in'
  }

  fc.on('mouse:down', onMouseDown)

  return () => {
    offAll(fc, { 'mouse:down': onMouseDown })
  }
}

function activateBrush(fc, toolOptions) {
  const { size, color, opacity } = toolOptions.brush
  fc.isDrawingMode = true
  fc.selection = false

  const brush = new PencilBrush(fc)
  brush.color = color ?? '#000000'
  brush.width = size ?? 12
  // Fabric PencilBrush doesn't have a native opacity — we set it via globalAlpha
  // by wrapping color with rgba when opacity < 100
  if (opacity !== undefined && opacity < 100) {
    const alpha = opacity / 100
    // Only parse if color is a valid 6-digit hex; otherwise fall back to the raw color string
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      brush.color = `rgba(${r},${g},${b},${alpha})`
    }
    // If color is not a 6-digit hex (e.g. named color or 3-digit hex),
    // keep the raw color value; opacity blending will not apply in that case.
  }
  fc.freeDrawingBrush = brush

  return () => {
    fc.isDrawingMode = false
  }
}

function activateEraser(fc, toolOptions) {
  const { size } = toolOptions.eraser

  fc.isDrawingMode = true
  fc.selection = false

  // NOTE: EraserBrush is not available in this fabric build.
  // Use a PencilBrush with globalCompositeOperation='destination-out' to perform
  // real pixel erasure on transparent canvases. On non-transparent backgrounds
  // the result will show as transparent rather than the background color.
  const brush = new PencilBrush(fc)
  brush.width = size ?? 20
  // Use a fully-opaque black; destination-out ignores colour — only alpha matters
  brush.color = 'rgba(0,0,0,1)'
  // Apply the composite operation so strokes erase pixels rather than paint
  const origBeforePathCreated = fc.__eventListeners?.['before:path:created']
  fc.on('before:path:created', (e) => {
    if (e.path) {
      e.path.globalCompositeOperation = 'destination-out'
    }
  })
  fc.freeDrawingBrush = brush

  return () => {
    fc.isDrawingMode = false
    fc.off('before:path:created')
  }
}

function activateText(fc, toolOptions) {
  fc.isDrawingMode = false
  fc.selection = true
  fc.defaultCursor = 'text'

  const opts = toolOptions.text ?? {}

  const onMouseDown = (e) => {
    // Avoid creating text when clicking on an existing object
    if (fc.findTarget(e.e)) return

    const point = getPointer(fc, e)
    const text = new IText('', {
      left: point.x,
      top: point.y,
      fontSize: opts.size ?? 24,
      fill: opts.color ?? '#000000',
      fontFamily: opts.font ?? 'Arial',
      fontWeight: opts.bold ? 'bold' : 'normal',
      fontStyle: opts.italic ? 'italic' : 'normal',
    })

    fc.add(text)
    fc.setActiveObject(text)
    text.enterEditing()
    fc.renderAll()
  }

  fc.on('mouse:down', onMouseDown)

  return () => {
    fc.defaultCursor = 'default'
    offAll(fc, { 'mouse:down': onMouseDown })
  }
}

function activateRect(fc, toolOptions) {
  fc.isDrawingMode = false
  fc.selection = false
  fc.defaultCursor = 'crosshair'

  const opts = toolOptions.rect ?? {}

  let drawingShape = false
  let shapeOrigin = { x: 0, y: 0 }
  let activeShape = null

  const onMouseDown = (e) => {
    if (fc.findTarget(e.e)) return
    drawingShape = true
    const point = getPointer(fc, e)
    shapeOrigin = point

    activeShape = new Rect({
      left: point.x,
      top: point.y,
      width: 0,
      height: 0,
      fill: opts.fill ?? '#ff0000',
      stroke: opts.stroke !== 'transparent' ? opts.stroke : undefined,
      strokeWidth: opts.strokeWidth ?? 0,
      selectable: false,
      evented: false,
    })
    fc.add(activeShape)
  }

  const onMouseMove = (e) => {
    if (!drawingShape || !activeShape) return
    const point = getPointer(fc, e)
    const x = Math.min(point.x, shapeOrigin.x)
    const y = Math.min(point.y, shapeOrigin.y)
    const w = Math.abs(point.x - shapeOrigin.x)
    const h = Math.abs(point.y - shapeOrigin.y)
    activeShape.set({ left: x, top: y, width: w, height: h })
    fc.renderAll()
  }

  const onMouseUp = () => {
    if (!drawingShape || !activeShape) return
    drawingShape = false
    activeShape.selectable = true
    activeShape.evented = true
    fc.setActiveObject(activeShape)
    fc.renderAll()
    activeShape = null
  }

  fc.on('mouse:down', onMouseDown)
  fc.on('mouse:move', onMouseMove)
  fc.on('mouse:up', onMouseUp)

  return () => {
    drawingShape = false
    activeShape = null
    fc.defaultCursor = 'default'
    offAll(fc, {
      'mouse:down': onMouseDown,
      'mouse:move': onMouseMove,
      'mouse:up': onMouseUp,
    })
  }
}

function activateEllipse(fc, toolOptions) {
  fc.isDrawingMode = false
  fc.selection = false
  fc.defaultCursor = 'crosshair'

  const opts = toolOptions.ellipse ?? {}

  let drawingShape = false
  let shapeOrigin = { x: 0, y: 0 }
  let activeShape = null

  const onMouseDown = (e) => {
    if (fc.findTarget(e.e)) return
    drawingShape = true
    const point = getPointer(fc, e)
    shapeOrigin = point

    activeShape = new Ellipse({
      left: point.x,
      top: point.y,
      rx: 0,
      ry: 0,
      fill: opts.fill ?? '#0000ff',
      stroke: opts.stroke !== 'transparent' ? opts.stroke : undefined,
      strokeWidth: opts.strokeWidth ?? 0,
      selectable: false,
      evented: false,
    })
    fc.add(activeShape)
  }

  const onMouseMove = (e) => {
    if (!drawingShape || !activeShape) return
    const point = getPointer(fc, e)
    const rx = Math.abs(point.x - shapeOrigin.x) / 2
    const ry = Math.abs(point.y - shapeOrigin.y) / 2
    const cx = Math.min(point.x, shapeOrigin.x) + rx
    const cy = Math.min(point.y, shapeOrigin.y) + ry
    activeShape.set({ left: cx - rx, top: cy - ry, rx, ry })
    fc.renderAll()
  }

  const onMouseUp = () => {
    if (!drawingShape || !activeShape) return
    drawingShape = false
    activeShape.selectable = true
    activeShape.evented = true
    fc.setActiveObject(activeShape)
    fc.renderAll()
    activeShape = null
  }

  fc.on('mouse:down', onMouseDown)
  fc.on('mouse:move', onMouseMove)
  fc.on('mouse:up', onMouseUp)

  return () => {
    drawingShape = false
    activeShape = null
    fc.defaultCursor = 'default'
    offAll(fc, {
      'mouse:down': onMouseDown,
      'mouse:move': onMouseMove,
      'mouse:up': onMouseUp,
    })
  }
}

function activateCrop(fc) {
  fc.isDrawingMode = false
  fc.selection = false
  fc.defaultCursor = 'crosshair'

  let cropRect = null
  let cropDrawing = false
  let cropOrigin = { x: 0, y: 0 }
  let cropOverlay = null
  // AbortController to clean up button listeners on deactivation
  let abortController = new AbortController()

  const onMouseDown = (e) => {
    cropDrawing = true
    const point = getPointer(fc, e)
    cropOrigin = point

    if (cropRect) {
      fc.remove(cropRect)
    }

    cropRect = new Rect({
      left: point.x,
      top: point.y,
      width: 0,
      height: 0,
      fill: 'rgba(0,0,0,0.2)',
      stroke: '#ffffff',
      strokeWidth: 1,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
    })
    fc.add(cropRect)
  }

  const onMouseMove = (e) => {
    if (!cropDrawing || !cropRect) return
    const point = getPointer(fc, e)
    const x = Math.min(point.x, cropOrigin.x)
    const y = Math.min(point.y, cropOrigin.y)
    const w = Math.abs(point.x - cropOrigin.x)
    const h = Math.abs(point.y - cropOrigin.y)
    cropRect.set({ left: x, top: y, width: w, height: h })
    fc.renderAll()
  }

  const onMouseUp = () => {
    if (!cropDrawing) return
    cropDrawing = false
    if (!cropRect || cropRect.width < 2 || cropRect.height < 2) return

    // Abort any previous button listeners before creating a new overlay
    abortController.abort()
    abortController = new AbortController()

    // Show confirm / cancel buttons as DOM overlay positioned over the canvas
    const canvasEl = fc.getElement()
    const container = canvasEl.parentElement ?? document.body

    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:absolute;bottom:8px;left:50%;transform:translateX(-50%);' +
      'display:flex;gap:8px;z-index:9999;pointer-events:all;'

    const confirmBtn = document.createElement('button')
    confirmBtn.textContent = 'Crop'
    confirmBtn.style.cssText =
      'padding:6px 16px;background:#3b82f6;color:#fff;border:none;border-radius:4px;cursor:pointer;'

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = 'Cancel'
    cancelBtn.style.cssText =
      'padding:6px 16px;background:#6b7280;color:#fff;border:none;border-radius:4px;cursor:pointer;'

    overlay.appendChild(confirmBtn)
    overlay.appendChild(cancelBtn)
    container.style.position = 'relative'
    container.appendChild(overlay)
    cropOverlay = overlay

    confirmBtn.addEventListener('click', () => {
      if (cropRect) {
        // Apply crop using clipPath
        const cropClone = new Rect({
          left: cropRect.left,
          top: cropRect.top,
          width: cropRect.width,
          height: cropRect.height,
          absolutePositioned: true,
        })
        fc.clipPath = cropClone
        fc.remove(cropRect)
        cropRect = null
        fc.renderAll()
      }
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
      cropOverlay = null
    }, { signal: abortController.signal })

    cancelBtn.addEventListener('click', () => {
      if (cropRect) {
        fc.remove(cropRect)
        cropRect = null
        fc.renderAll()
      }
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
      cropOverlay = null
    }, { signal: abortController.signal })
  }

  fc.on('mouse:down', onMouseDown)
  fc.on('mouse:move', onMouseMove)
  fc.on('mouse:up', onMouseUp)

  return () => {
    cropDrawing = false
    // Abort button listeners to prevent stale callbacks
    abortController.abort()
    if (cropRect) {
      fc.remove(cropRect)
      cropRect = null
    }
    if (cropOverlay && cropOverlay.parentNode) {
      cropOverlay.parentNode.removeChild(cropOverlay)
      cropOverlay = null
    }
    fc.defaultCursor = 'default'
    offAll(fc, {
      'mouse:down': onMouseDown,
      'mouse:move': onMouseMove,
      'mouse:up': onMouseUp,
    })
  }
}

function activateEyedropper(fc, _toolOptions, storeActions) {
  fc.isDrawingMode = false
  fc.selection = false
  fc.defaultCursor = 'crosshair'

  const onMouseDown = (e) => {
    const point = getPointer(fc, e)
    const ctx = fc.getContext('2d') ?? fc.lowerCanvasEl?.getContext('2d')
    if (!ctx) return

    const vpt = fc.viewportTransform
    // Apply the full affine transform matrix (including rotation/skew components)
    const px = Math.round(point.x * vpt[0] + point.y * vpt[2] + vpt[4])
    const py = Math.round(point.x * vpt[1] + point.y * vpt[3] + vpt[5])

    try {
      const data = ctx.getImageData(px, py, 1, 1).data
      const hex =
        '#' +
        [data[0], data[1], data[2]]
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('')
      if (storeActions?.setForegroundColor) {
        storeActions.setForegroundColor(hex)
      }
    } catch (_) {
      // Cross-origin canvas security error — ignore
    }
  }

  fc.on('mouse:down', onMouseDown)

  return () => {
    fc.defaultCursor = 'default'
    offAll(fc, { 'mouse:down': onMouseDown })
  }
}

function activateLasso(fc) {
  fc.isDrawingMode = false
  fc.selection = false
  fc.defaultCursor = 'crosshair'

  let lassoPoints = []
  let lassoPath = null
  let lassoDrawing = false
  let pathString = ''

  const onMouseDown = (e) => {
    lassoDrawing = true
    lassoPoints = []
    const point = getPointer(fc, e)
    lassoPoints.push(point)
    pathString = `M ${point.x} ${point.y}`

    if (lassoPath) {
      fc.remove(lassoPath)
      lassoPath = null
    }
  }

  const onMouseMove = (e) => {
    if (!lassoDrawing) return
    const point = getPointer(fc, e)
    lassoPoints.push(point)
    pathString += ` L ${point.x} ${point.y}`

    if (lassoPath) fc.remove(lassoPath)

    lassoPath = new Path(pathString + ' Z', {
      fill: 'rgba(59,130,246,0.15)',
      stroke: '#3b82f6',
      strokeWidth: 1,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
    })
    fc.add(lassoPath)
    fc.renderAll()
  }

  const onMouseUp = () => {
    if (!lassoDrawing) return
    lassoDrawing = false

    if (lassoPoints.length < 3) {
      if (lassoPath) { fc.remove(lassoPath); lassoPath = null }
      fc.renderAll()
      return
    }

    // Close the path and finalise as a selection mask
    pathString += ' Z'
    if (lassoPath) fc.remove(lassoPath)

    lassoPath = new Path(pathString, {
      fill: 'rgba(59,130,246,0.15)',
      stroke: '#3b82f6',
      strokeWidth: 1,
      strokeDashArray: [4, 4],
      selectable: true,
      evented: true,
    })
    fc.add(lassoPath)
    fc.setActiveObject(lassoPath)
    fc.renderAll()

    lassoPoints = []
    pathString = ''
  }

  fc.on('mouse:down', onMouseDown)
  fc.on('mouse:move', onMouseMove)
  fc.on('mouse:up', onMouseUp)

  return () => {
    lassoDrawing = false
    lassoPoints = []
    if (lassoPath) {
      fc.remove(lassoPath)
      lassoPath = null
    }
    fc.defaultCursor = 'default'
    offAll(fc, {
      'mouse:down': onMouseDown,
      'mouse:move': onMouseMove,
      'mouse:up': onMouseUp,
    })
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Activate a tool, cleaning up any previously active tool first.
 *
 * @param {string} toolId
 * @param {Object} toolOptions  From the Zustand store.
 * @param {Object} storeActions  Subset of store actions (e.g. setForegroundColor).
 */
export function activateTool(toolId, toolOptions, storeActions) {
  const fc = getFabric()
  if (!fc) return

  // Deactivate all previously active tools before registering the new one
  Object.keys(_disposers).forEach((id) => removeDisposer(id))

  let disposer = () => {}

  switch (toolId) {
    case 'select':
      disposer = activateSelect(fc)
      break
    case 'hand':
      disposer = activateHand(fc)
      break
    case 'zoom':
      disposer = activateZoom(fc)
      break
    case 'brush':
      disposer = activateBrush(fc, toolOptions)
      break
    case 'eraser':
      disposer = activateEraser(fc, toolOptions, storeActions)
      break
    case 'text':
      disposer = activateText(fc, toolOptions)
      break
    case 'rect':
      disposer = activateRect(fc, toolOptions)
      break
    case 'ellipse':
      disposer = activateEllipse(fc, toolOptions)
      break
    case 'crop':
      disposer = activateCrop(fc)
      break
    case 'eyedropper':
      disposer = activateEyedropper(fc, toolOptions, storeActions)
      break
    case 'lasso':
      disposer = activateLasso(fc)
      break
    default:
      disposer = activateSelect(fc)
      break
  }

  _disposers[toolId] = disposer
}

/**
 * Deactivate a specific tool, removing all its event listeners.
 * @param {string} toolId
 */
export function deactivateTool(toolId) {
  removeDisposer(toolId)
}
