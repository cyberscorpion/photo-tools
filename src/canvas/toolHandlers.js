import { IText, Rect, Ellipse, Path, PencilBrush, FabricImage } from 'fabric'
import { getFabric } from './fabricManager.js'
import { panContainer } from './viewportManager.js'
import { useEditorStore } from '../store/editorStore.js'

// ── Internal state ────────────────────────────────────────────────────────────

/** Tool-specific disposer functions keyed by tool id. */
const _disposers = {}

let _cropConfirm = null
let _cropCancel = null

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
  fc.forEachObject((o) => {
    if (o.layerId === 'background' || o.layerId === 'contour') {
      o.selectable = false
      o.evented = false
    } else {
      o.selectable = true
      o.evented = true
    }
  })

  // Alt+drag: duplicate the active object
  let altDragOriginal = null

  const onMouseDown = (e) => {
    if (!e.e.altKey) return
    const target = fc.getActiveObject()
    if (!target || target.layerId === 'background' || target.layerId === 'contour') return
    // Clone and place at same position; drag will move the clone
    target.clone().then((cloned) => {
      cloned.set({ left: target.left + 10, top: target.top + 10 })
      fc.add(cloned)
      fc.setActiveObject(cloned)
      fc.renderAll()
    })
  }

  fc.on('mouse:down', onMouseDown)

  return () => {
    altDragOriginal = null
    fc.off('mouse:down', onMouseDown)
  }
}

function activateHand(fc) {
  fc.isDrawingMode = false
  fc.selection = false
  fc.defaultCursor = 'grab'
  fc.forEachObject((o) => { o.selectable = false; o.evented = false })

  let isPanning = false
  let lastX = 0, lastY = 0

  const onMouseDown = (e) => {
    isPanning = true
    lastX = e.e.clientX
    lastY = e.e.clientY
    fc.defaultCursor = 'grabbing'
  }

  const onMouseMove = (e) => {
    if (!isPanning) return
    const dx = lastX - e.e.clientX
    const dy = lastY - e.e.clientY
    lastX = e.e.clientX
    lastY = e.e.clientY
    panContainer(dx, dy)
  }

  const onMouseUp = () => { isPanning = false; fc.defaultCursor = 'grab' }

  fc.on('mouse:down', onMouseDown)
  fc.on('mouse:move', onMouseMove)
  fc.on('mouse:up', onMouseUp)

  return () => {
    isPanning = false
    offAll(fc, { 'mouse:down': onMouseDown, 'mouse:move': onMouseMove, 'mouse:up': onMouseUp })
  }
}

function activateZoom(fc) {
  fc.isDrawingMode = false
  fc.selection = false
  fc.defaultCursor = 'zoom-in'
  fc.forEachObject((o) => { o.selectable = false; o.evented = false })

  const onMouseDown = (e) => {
    const isZoomOut = e.e.shiftKey || e.e.altKey
    const factor = isZoomOut ? 0.8 : 1.25
    const currentZoom = useEditorStore.getState().zoom
    const newZoom = Math.max(0.05, Math.min(16, parseFloat((currentZoom * factor).toFixed(3))))
    useEditorStore.getState().setZoom(newZoom)
    fc.defaultCursor = isZoomOut ? 'zoom-out' : 'zoom-in'
  }

  fc.on('mouse:down', onMouseDown)
  return () => { offAll(fc, { 'mouse:down': onMouseDown }) }
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
  const beforePathCreatedHandler = (e) => {
    if (e.path) {
      e.path.globalCompositeOperation = 'destination-out'
    }
  }
  fc.on('before:path:created', beforePathCreatedHandler)
  fc.freeDrawingBrush = brush

  return () => {
    fc.isDrawingMode = false
    fc.off('before:path:created', beforePathCreatedHandler)
  }
}

function activateText(fc, toolOptions) {
  fc.isDrawingMode = false
  fc.selection = true
  fc.defaultCursor = 'text'

  const opts = toolOptions.text ?? {}

  const onMouseDown = (e) => {
    const target = fc.findTarget(e.e)

    // If the clicked target is an existing IText, enter edit mode on it
    if (target instanceof IText) {
      fc.setActiveObject(target)
      target.enterEditing()
      fc.renderAll()
      return
    }

    // Avoid creating text when clicking on any other existing object
    if (target) return

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

  // Lock existing objects so the background image doesn't intercept drawing events
  fc.forEachObject((o) => {
    o._rectSavedSel = o.selectable
    o._rectSavedEvt = o.evented
    o.selectable = false
    o.evented = false
  })

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
    const dx = point.x - shapeOrigin.x
    const dy = point.y - shapeOrigin.y
    let x, y, w, h
    if (e.e.shiftKey) {
      // Shift → perfect square; preserve drag direction
      const size = Math.min(Math.abs(dx), Math.abs(dy))
      x = dx < 0 ? shapeOrigin.x - size : shapeOrigin.x
      y = dy < 0 ? shapeOrigin.y - size : shapeOrigin.y
      w = size
      h = size
    } else {
      x = Math.min(point.x, shapeOrigin.x)
      y = Math.min(point.y, shapeOrigin.y)
      w = Math.abs(dx)
      h = Math.abs(dy)
    }
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
    // Restore object interactivity
    fc.forEachObject((o) => {
      if ('_rectSavedSel' in o) { o.selectable = o._rectSavedSel; delete o._rectSavedSel }
      if ('_rectSavedEvt' in o) { o.evented = o._rectSavedEvt; delete o._rectSavedEvt }
    })
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

  // Lock existing objects so the background image doesn't intercept drawing events
  fc.forEachObject((o) => {
    o._ellSavedSel = o.selectable
    o._ellSavedEvt = o.evented
    o.selectable = false
    o.evented = false
  })

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
    const dx = point.x - shapeOrigin.x
    const dy = point.y - shapeOrigin.y
    let rx, ry, cx, cy
    if (e.e.shiftKey) {
      // Shift → perfect circle; preserve drag direction
      const size = Math.min(Math.abs(dx), Math.abs(dy))
      rx = size / 2
      ry = size / 2
      cx = (dx < 0 ? shapeOrigin.x - size : shapeOrigin.x) + rx
      cy = (dy < 0 ? shapeOrigin.y - size : shapeOrigin.y) + ry
    } else {
      rx = Math.abs(dx) / 2
      ry = Math.abs(dy) / 2
      cx = Math.min(point.x, shapeOrigin.x) + rx
      cy = Math.min(point.y, shapeOrigin.y) + ry
    }
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
    // Restore object interactivity
    fc.forEachObject((o) => {
      if ('_ellSavedSel' in o) { o.selectable = o._ellSavedSel; delete o._ellSavedSel }
      if ('_ellSavedEvt' in o) { o.evented = o._ellSavedEvt; delete o._ellSavedEvt }
    })
    offAll(fc, {
      'mouse:down': onMouseDown,
      'mouse:move': onMouseMove,
      'mouse:up': onMouseUp,
    })
  }
}

function activateCrop(fc) {
  fc.isDrawingMode = false
  fc.selection = true    // Must be true so Fabric shows handles on the crop rect
  fc.defaultCursor = 'default'

  // Lock all existing objects so only the crop rect is interactive
  fc.forEachObject((o) => {
    o._cropSaved = { selectable: o.selectable, evented: o.evented }
    o.selectable = false
    o.evented = false
  })

  let cropRect = null
  let overlayRects = []
  let cropDrawing = false
  let cropOrigin = { x: 0, y: 0 }

  // ── Build a styled crop rect with Fabric's resize handles ─────────────────
  const makeCropRect = (left, top, width, height) => {
    const r = new Rect({
      left, top, width, height,
      fill: 'transparent',
      stroke: '#ffffff',
      strokeWidth: 1,
      strokeDashArray: [6, 3],
      selectable: true,
      evented: true,
      lockRotation: true,
      lockSkewingX: true,
      lockSkewingY: true,
      cornerColor: '#ffffff',
      cornerStyle: 'rect',
      cornerSize: 9,
      cornerStrokeColor: '#cccccc',
      transparentCorners: false,
      borderColor: 'rgba(255,255,255,0.85)',
      borderScaleFactor: 1,
      hasRotatingPoint: false,
    })
    r.setControlsVisibility({ mtr: false })   // hide rotation handle
    r.layerId = 'crop-overlay'
    return r
  }

  // ── Semi-transparent darkening strips outside the crop rect ───────────────
  const updateOverlay = () => {
    overlayRects.forEach((r) => fc.remove(r))
    overlayRects = []
    if (!cropRect) return

    // Get actual rendered bounds (accounts for scaleX/scaleY from handle dragging)
    const b = cropRect.getBoundingRect()
    const cw = fc.width, ch = fc.height
    const cl = Math.max(0, b.left), ct = Math.max(0, b.top)
    const cr = Math.min(cw, b.left + b.width), cb = Math.min(ch, b.top + b.height)
    const dark = 'rgba(0,0,0,0.45)'

    const strips = [
      [0,   0,   cw,      ct     ],   // top
      [0,   cb,  cw,      ch - cb],   // bottom
      [0,   ct,  cl,      cb - ct],   // left
      [cr,  ct,  cw - cr, cb - ct],   // right
    ]

    strips.forEach(([l, t, w, h]) => {
      if (w <= 0 || h <= 0) return
      const strip = new Rect({ left: l, top: t, width: w, height: h,
        fill: dark, selectable: false, evented: false, layerId: 'crop-overlay' })
      overlayRects.push(strip)
      fc.add(strip)
      fc.sendObjectToBack(strip)
    })

    fc.bringObjectToFront(cropRect)
    fc.renderAll()
  }

  // ── Create initial crop rect covering the full canvas ─────────────────────
  cropRect = makeCropRect(0, 0, fc.width, fc.height)
  fc.add(cropRect)
  fc.setActiveObject(cropRect)
  updateOverlay()

  // Signal immediately so OptionsBar shows Apply/Cancel
  useEditorStore.getState().setCropMode(true)

  // Update overlay strips whenever the crop rect is transformed
  fc.on('object:moving',  updateOverlay)
  fc.on('object:scaling', updateOverlay)
  fc.on('object:modified', updateOverlay)

  // ── Allow drawing a NEW crop rect by dragging on blank canvas ─────────────
  const onMouseDown = (e) => {
    const target = fc.findTarget(e.e)
    if (target && target.layerId === 'crop-overlay') return  // clicking on crop rect → Fabric handles it
    if (target) return

    cropDrawing = true
    const point = getPointer(fc, e)
    cropOrigin = point

    // Remove current crop rect and overlays
    if (cropRect) { fc.remove(cropRect); cropRect = null }
    overlayRects.forEach((r) => fc.remove(r)); overlayRects = []

    cropRect = makeCropRect(point.x, point.y, 0, 0)
    fc.add(cropRect)
  }

  const onMouseMove = (e) => {
    if (!cropDrawing || !cropRect) return
    const point = getPointer(fc, e)
    const dx = point.x - cropOrigin.x
    const dy = point.y - cropOrigin.y
    const size = e.e.shiftKey ? Math.min(Math.abs(dx), Math.abs(dy)) : null
    cropRect.set({
      left:   dx < 0 ? (size ? cropOrigin.x - size : point.x) : cropOrigin.x,
      top:    dy < 0 ? (size ? cropOrigin.y - size : point.y) : cropOrigin.y,
      width:  size || Math.abs(dx),
      height: size || Math.abs(dy),
    })
    fc.renderAll()
  }

  const onMouseUp = () => {
    if (!cropDrawing) return
    cropDrawing = false
    if (!cropRect || cropRect.width < 4 || cropRect.height < 4) {
      // Tiny drag → restore full-canvas crop rect
      if (cropRect) { fc.remove(cropRect); cropRect = null }
      cropRect = makeCropRect(0, 0, fc.width, fc.height)
      fc.add(cropRect)
    }
    fc.setActiveObject(cropRect)
    updateOverlay()
  }

  // ── Shared helpers ────────────────────────────────────────────────────────
  const restoreObjects = () => {
    fc.forEachObject((o) => {
      if (o._cropSaved) {
        o.selectable = o._cropSaved.selectable
        o.evented    = o._cropSaved.evented
        delete o._cropSaved
      }
    })
  }

  const clearOverlay = () => {
    if (cropRect) { fc.remove(cropRect); cropRect = null }
    overlayRects.forEach((r) => fc.remove(r)); overlayRects = []
    fc.discardActiveObject()
    fc.renderAll()
  }

  const doCancel = () => {
    clearOverlay()
    restoreObjects()
    useEditorStore.getState().setCropMode(false)
    _cropConfirm = null
    _cropCancel = null
  }

  const doConfirm = async () => {
    if (!cropRect) { doCancel(); return }

    // getBoundingRect() accounts for scaleX/scaleY from handle dragging
    const b  = cropRect.getBoundingRect()
    const x  = Math.max(0, Math.round(b.left))
    const y  = Math.max(0, Math.round(b.top))
    const w  = Math.min(fc.width  - x, Math.round(b.width))
    const h  = Math.min(fc.height - y, Math.round(b.height))

    if (w < 2 || h < 2) { doCancel(); return }

    clearOverlay()

    const srcEl   = fc.getElement()
    const offscreen = document.createElement('canvas')
    offscreen.width  = w
    offscreen.height = h
    offscreen.getContext('2d').drawImage(srcEl, x, y, w, h, 0, 0, w, h)
    const croppedDataURL = offscreen.toDataURL('image/png')

    fc.clear()
    fc.setWidth(w)
    fc.setHeight(h)

    const img = await FabricImage.fromURL(croppedDataURL)
    img.set({ left: 0, top: 0, selectable: false, evented: false, layerId: 'background' })
    fc.add(img)
    fc.renderAll()

    restoreObjects()

    const st = useEditorStore.getState()
    st.setImageSize({ w, h })
    st.setHasImage(true)
    st.setCropMode(false)
    st.pushHistory('Crop', fc.toJSON(['customId', 'layerId']))
    _cropConfirm = null
    _cropCancel = null
  }

  _cropConfirm = doConfirm
  _cropCancel = doCancel

  fc.on('mouse:down', onMouseDown)
  fc.on('mouse:move', onMouseMove)
  fc.on('mouse:up', onMouseUp)

  return () => {
    cropDrawing = false
    fc.off('object:moving',  updateOverlay)
    fc.off('object:scaling', updateOverlay)
    fc.off('object:modified', updateOverlay)
    doCancel()
    offAll(fc, { 'mouse:down': onMouseDown, 'mouse:move': onMouseMove, 'mouse:up': onMouseUp })
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

export function confirmCrop() { _cropConfirm?.() }
export function cancelCrop() { _cropCancel?.() }

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
