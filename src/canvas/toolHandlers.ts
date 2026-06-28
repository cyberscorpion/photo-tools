import { IText, Rect, Ellipse, Path, PencilBrush, FabricImage, Line, Polygon, Circle } from 'fabric'
import { buildPolygonPoints } from '../utils/canvasOps.ts'
import { getFabric, setSuppressHistoryBridge } from './fabricManager.js'
import { panContainer } from './viewportManager.js'
import { useEditorStore } from '../store/editorStore.js'
import { showSelectionRect, showSelectionEllipse, showSelectionPath, clearSelectionOverlay } from './selectionOverlay.ts'
import { floodFill, applyMaskFill, hexToRgbArr, getLowerCtx, getLowerCanvasEl, reloadCanvasAsImage, sampleCircle, boxBlur } from '../utils/canvasOps.ts'

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

  // Update cursor immediately when Shift/Alt is pressed (before clicking)
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.shiftKey || ev.altKey) fc.defaultCursor = 'zoom-out'
  }
  const onKeyUp = () => { fc.defaultCursor = 'zoom-in' }
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)

  fc.on('mouse:down', onMouseDown)
  return () => {
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('keyup', onKeyUp)
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

  // ── Alt key = temporary eyedropper ──────────────────────────────────────────
  let altMode = false

  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.altKey && !altMode && !ev.ctrlKey && !ev.metaKey) {
      altMode = true
      fc.isDrawingMode = false
      fc.defaultCursor = 'crosshair'
    }
  }
  const onKeyUp = (ev: KeyboardEvent) => {
    if (!ev.altKey && altMode) {
      altMode = false
      fc.isDrawingMode = true
      fc.defaultCursor = 'crosshair'
    }
  }
  const onAltClick = (e: any) => {
    if (!altMode) return
    const p = getPointer(fc, e)
    const ctx = (fc.getElement() as HTMLCanvasElement).getContext('2d')
    if (!ctx) return
    const d = ctx.getImageData(Math.max(0, Math.round(p.x)), Math.max(0, Math.round(p.y)), 1, 1).data
    const hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('')
    useEditorStore.getState().setForegroundColor(hex)
    // Immediately update brush colour
    brush.color = hex
    useEditorStore.getState().setToolOption('brush', 'color', hex)
  }

  // ── Shift + last-point = straight line ─────────────────────────────────────
  let lastBrushEnd: { x: number; y: number } | null = null
  fc.on('path:created', (e: any) => {
    const coords = e.path?.path as [string, number, number][] | undefined
    if (coords?.length) {
      const last = coords[coords.length - 1]
      if (last) lastBrushEnd = { x: last[1], y: last[2] }
    }
  })

  const onBrushMouseDown = (e: any) => {
    if (altMode) { onAltClick(e); return }
    // Shift + click draws a straight line from last brush end point
    if (e.e.shiftKey && lastBrushEnd) {
      const p = getPointer(fc, e)
      const linePath = new Path(
        `M ${lastBrushEnd.x} ${lastBrushEnd.y} L ${p.x} ${p.y}`,
        {
          stroke: brush.color,
          strokeWidth: brush.width,
          fill: 'transparent',
          globalCompositeOperation: 'source-over',
        } as any
      )
      fc.add(linePath)
      fc.renderAll()
      useEditorStore.getState().pushHistory('Brush Straight', fc.toJSON(['customId', 'layerId']))
      lastBrushEnd = { x: p.x, y: p.y }
    }
  }

  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  fc.on('mouse:down', onBrushMouseDown)

  return () => {
    fc.isDrawingMode = false
    altMode = false
    lastBrushEnd = null
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('keyup', onKeyUp)
    fc.off('mouse:down', onBrushMouseDown)
    fc.off('path:created')
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

  // Push history when text editing is committed (editing:exited doesn't fire object:modified)
  const onEditingExited = () => {
    useEditorStore.getState().pushHistory('Add Text', fc.toJSON(['customId', 'layerId']))
  }
  fc.on('text:editing:exited', onEditingExited)
  fc.on('mouse:down', onMouseDown)

  return () => {
    fc.defaultCursor = 'default'
    fc.off('text:editing:exited', onEditingExited)
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
      // _tool: 'rect' — used only as a label tag
      evented: false,
    })
    fc.add(activeShape)
  }

  const onMouseMove = (e) => {
    if (!drawingShape || !activeShape) return
    const point = getPointer(fc, e)
    const dx = point.x - shapeOrigin.x
    const dy = point.y - shapeOrigin.y
    let x: number, y: number, w: number, h: number

    if (e.e.shiftKey && e.e.altKey) {
      // Shift+Alt: constrained square from center
      const size = Math.min(Math.abs(dx), Math.abs(dy))
      x = shapeOrigin.x - size; y = shapeOrigin.y - size; w = size * 2; h = size * 2
    } else if (e.e.altKey) {
      // Alt: draw from center
      w = Math.abs(dx) * 2; h = Math.abs(dy) * 2
      x = shapeOrigin.x - Math.abs(dx); y = shapeOrigin.y - Math.abs(dy)
    } else if (e.e.shiftKey) {
      // Shift: constrain to square
      const size = Math.min(Math.abs(dx), Math.abs(dy))
      x = dx < 0 ? shapeOrigin.x - size : shapeOrigin.x
      y = dy < 0 ? shapeOrigin.y - size : shapeOrigin.y
      w = size; h = size
    } else {
      x = Math.min(point.x, shapeOrigin.x); y = Math.min(point.y, shapeOrigin.y)
      w = Math.abs(dx); h = Math.abs(dy)
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
    useEditorStore.getState().pushHistory('Draw Rectangle', fc.toJSON(['customId', 'layerId']))
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
    let rx: number, ry: number, cx: number, cy: number

    if (e.e.shiftKey && e.e.altKey) {
      const size = Math.min(Math.abs(dx), Math.abs(dy)) / 2
      rx = size; ry = size; cx = shapeOrigin.x; cy = shapeOrigin.y
    } else if (e.e.altKey) {
      rx = Math.abs(dx); ry = Math.abs(dy); cx = shapeOrigin.x; cy = shapeOrigin.y
    } else if (e.e.shiftKey) {
      const size = Math.min(Math.abs(dx), Math.abs(dy)) / 2
      rx = size; ry = size
      cx = (dx < 0 ? shapeOrigin.x - size * 2 : shapeOrigin.x) + rx
      cy = (dy < 0 ? shapeOrigin.y - size * 2 : shapeOrigin.y) + ry
    } else {
      rx = Math.abs(dx) / 2; ry = Math.abs(dy) / 2
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
    useEditorStore.getState().pushHistory('Draw Ellipse', fc.toJSON(['customId', 'layerId']))
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


function activateLine(fc: any, toolOptions: any) {
  fc.isDrawingMode = false; fc.selection = false; fc.defaultCursor = 'crosshair'
  fc.forEachObject((o: any) => { o._lSaved = { s: o.selectable, e: o.evented }; o.selectable = false; o.evented = false })
  const opts = toolOptions.line ?? { stroke: '#000000', strokeWidth: 2 }
  let drawing = false, origin = { x: 0, y: 0 }, shape: any = null

  const onMouseDown = (e: any) => {
    drawing = true; origin = getPointer(fc, e)
    shape = new Line([origin.x, origin.y, origin.x, origin.y], {
      stroke: opts.stroke, strokeWidth: opts.strokeWidth, selectable: false, evented: false
    } as any)
    fc.add(shape)
  }
  const onMouseMove = (e: any) => {
    if (!drawing || !shape) return
    const p = getPointer(fc, e)
    let x2 = p.x, y2 = p.y
    if (e.e.shiftKey) {
      const dx = p.x - origin.x, dy = p.y - origin.y
      const angle = Math.round(Math.atan2(dy, dx) / (Math.PI/4)) * (Math.PI/4)
      const len = Math.hypot(dx, dy)
      x2 = origin.x + len * Math.cos(angle); y2 = origin.y + len * Math.sin(angle)
    }
    shape.set({ x2, y2 }); fc.renderAll()
  }
  const onMouseUp = () => {
    if (!drawing || !shape) return; drawing = false
    shape.selectable = true; shape.evented = true
    fc.setActiveObject(shape); fc.renderAll(); shape = null
    useEditorStore.getState().pushHistory('Draw Line', fc.toJSON(['customId', 'layerId']))
  }
  fc.on('mouse:down', onMouseDown); fc.on('mouse:move', onMouseMove); fc.on('mouse:up', onMouseUp)
  return () => {
    drawing = false; shape = null; fc.defaultCursor = 'default'
    fc.forEachObject((o: any) => { if (o._lSaved) { o.selectable = o._lSaved.s; o.evented = o._lSaved.e; delete o._lSaved } })
    offAll(fc, { 'mouse:down': onMouseDown, 'mouse:move': onMouseMove, 'mouse:up': onMouseUp })
  }
}

function activateRoundedRect(fc: any, toolOptions: any) {
  fc.isDrawingMode = false; fc.selection = false; fc.defaultCursor = 'crosshair'
  fc.forEachObject((o: any) => { o._rrSaved = { s: o.selectable, e: o.evented }; o.selectable = false; o.evented = false })
  const opts = toolOptions['rounded-rect'] ?? { fill: '#ff0000', stroke: 'transparent', strokeWidth: 0, radius: 10 }
  let drawing = false, origin = { x: 0, y: 0 }, shape: any = null

  const onMouseDown = (e: any) => {
    drawing = true; origin = getPointer(fc, e)
    shape = new Rect({ left: origin.x, top: origin.y, width: 0, height: 0,
      rx: opts.radius, ry: opts.radius,
      fill: opts.fill, stroke: opts.stroke !== 'transparent' ? opts.stroke : undefined, strokeWidth: opts.strokeWidth,
      selectable: false, evented: false } as any)
    fc.add(shape)
  }
  const onMouseMove = (e: any) => {
    if (!drawing || !shape) return
    const p = getPointer(fc, e), dx = p.x - origin.x, dy = p.y - origin.y
    let left: number, top: number, width: number, height: number

    if (e.e.shiftKey && e.e.altKey) {
      const size = Math.min(Math.abs(dx), Math.abs(dy))
      left = origin.x - size; top = origin.y - size; width = size * 2; height = size * 2
    } else if (e.e.altKey) {
      width = Math.abs(dx) * 2; height = Math.abs(dy) * 2
      left = origin.x - Math.abs(dx); top = origin.y - Math.abs(dy)
    } else if (e.e.shiftKey) {
      const size = Math.min(Math.abs(dx), Math.abs(dy))
      left = dx < 0 ? origin.x - size : origin.x; top = dy < 0 ? origin.y - size : origin.y
      width = size; height = size
    } else {
      left = dx < 0 ? p.x : origin.x; top = dy < 0 ? p.y : origin.y
      width = Math.abs(dx); height = Math.abs(dy)
    }
    shape.set({ left, top, width, height }); fc.renderAll()
  }
  const onMouseUp = () => {
    if (!drawing || !shape) return; drawing = false
    shape.selectable = true; shape.evented = true; fc.setActiveObject(shape); fc.renderAll(); shape = null
    useEditorStore.getState().pushHistory('Draw Rounded Rect', fc.toJSON(['customId', 'layerId']))
  }
  fc.on('mouse:down', onMouseDown); fc.on('mouse:move', onMouseMove); fc.on('mouse:up', onMouseUp)
  return () => {
    drawing = false; shape = null; fc.defaultCursor = 'default'
    fc.forEachObject((o: any) => { if (o._rrSaved) { o.selectable = o._rrSaved.s; o.evented = o._rrSaved.e; delete o._rrSaved } })
    offAll(fc, { 'mouse:down': onMouseDown, 'mouse:move': onMouseMove, 'mouse:up': onMouseUp })
  }
}

function activatePolygon(fc: any, toolOptions: any) {
  fc.isDrawingMode = false; fc.selection = false; fc.defaultCursor = 'crosshair'
  fc.forEachObject((o: any) => { o._pgSaved = { s: o.selectable, e: o.evented }; o.selectable = false; o.evented = false })
  const opts = toolOptions.polygon ?? { fill: '#ff0000', stroke: 'transparent', strokeWidth: 0, sides: 6 }
  let drawing = false, center = { x: 0, y: 0 }, shape: any = null

  const onMouseDown = (e: any) => {
    drawing = true; center = getPointer(fc, e)
    shape = new Polygon(buildPolygonPoints(center.x, center.y, 1, opts.sides), {
      fill: opts.fill, stroke: opts.stroke !== 'transparent' ? opts.stroke : undefined, strokeWidth: opts.strokeWidth,
      selectable: false, evented: false
    } as any)
    fc.add(shape)
  }
  const onMouseMove = (e: any) => {
    if (!drawing || !shape) return
    const p = getPointer(fc, e)
    const radius = Math.hypot(p.x - center.x, p.y - center.y)
    const angle = e.e.shiftKey ? -Math.PI/2 : Math.atan2(p.y - center.y, p.x - center.x) - Math.PI/2
    shape.set({ points: buildPolygonPoints(center.x, center.y, radius, opts.sides, angle) } as any)
    fc.renderAll()
  }
  const onMouseUp = () => {
    if (!drawing || !shape) return; drawing = false
    shape.selectable = true; shape.evented = true; fc.setActiveObject(shape); fc.renderAll(); shape = null
    useEditorStore.getState().pushHistory('Draw Polygon', fc.toJSON(['customId', 'layerId']))
  }
  fc.on('mouse:down', onMouseDown); fc.on('mouse:move', onMouseMove); fc.on('mouse:up', onMouseUp)
  return () => {
    drawing = false; shape = null; fc.defaultCursor = 'default'
    fc.forEachObject((o: any) => { if (o._pgSaved) { o.selectable = o._pgSaved.s; o.evented = o._pgSaved.e; delete o._pgSaved } })
    offAll(fc, { 'mouse:down': onMouseDown, 'mouse:move': onMouseMove, 'mouse:up': onMouseUp })
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

    const srcEl   = ((fc as any).lowerCanvasEl ?? fc.getElement()) as HTMLCanvasElement
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
    const ctx = ((fc as any).lowerCanvasEl as HTMLCanvasElement)?.getContext('2d')
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

function activateMarqueeRect(fc: any) {
  fc.isDrawingMode = false; fc.selection = false; fc.defaultCursor = 'crosshair'
  fc.forEachObject((o: any) => { o._mSel = o.selectable; o._mEvt = o.evented; o.selectable = false; o.evented = false })

  let drawing = false, origin = { x: 0, y: 0 }, previewRect: any = null

  const onMouseDown = (e: any) => {
    drawing = true
    origin = getPointer(fc, e)
    clearSelectionOverlay()
    if (previewRect) { fc.remove(previewRect); previewRect = null }
    previewRect = new Rect({ left: origin.x, top: origin.y, width: 0, height: 0,
      fill: 'rgba(0,120,215,0.12)', stroke: '#0078d4', strokeWidth: 1,
      strokeDashArray: [4,3], selectable: false, evented: false, layerId: 'selection' } as any)
    fc.add(previewRect)
  }
  const onMouseMove = (e: any) => {
    if (!drawing || !previewRect) return
    const p = getPointer(fc, e)
    const dx = p.x - origin.x, dy = p.y - origin.y
    let x = origin.x, y = origin.y, w = dx, h = dy
    if (e.e.shiftKey) { const s = Math.min(Math.abs(dx), Math.abs(dy)); w = dx < 0 ? -s : s; h = dy < 0 ? -s : s }
    previewRect.set({ left: w < 0 ? origin.x + w : origin.x, top: h < 0 ? origin.y + h : origin.y, width: Math.abs(w), height: Math.abs(h) })
    fc.renderAll()
  }
  const onMouseUp = () => {
    if (!drawing || !previewRect) return
    drawing = false
    const { left: bx, top: by, width: bw, height: bh } = previewRect
    fc.remove(previewRect); previewRect = null
    if (bw < 2 || bh < 2) { fc.renderAll(); return }
    const bounds = { x: Math.round(bx), y: Math.round(by), w: Math.round(bw), h: Math.round(bh) }
    showSelectionRect(bounds)
    useEditorStore.getState().setActiveSelection({ type: 'rect', bounds, mask: null })
  }
  fc.on('mouse:down', onMouseDown); fc.on('mouse:move', onMouseMove); fc.on('mouse:up', onMouseUp)
  return () => {
    drawing = false
    if (previewRect) { fc.remove(previewRect); previewRect = null }
    clearSelectionOverlay()
    fc.forEachObject((o: any) => { if ('_mSel' in o) { o.selectable = o._mSel; delete o._mSel; o.evented = o._mEvt; delete o._mEvt } })
    useEditorStore.getState().clearSelection?.()
    offAll(fc, { 'mouse:down': onMouseDown, 'mouse:move': onMouseMove, 'mouse:up': onMouseUp })
  }
}

function activateMarqueeEllipse(fc: any) {
  fc.isDrawingMode = false; fc.selection = false; fc.defaultCursor = 'crosshair'
  fc.forEachObject((o: any) => { o._mSel = o.selectable; o._mEvt = o.evented; o.selectable = false; o.evented = false })

  let drawing = false, origin = { x: 0, y: 0 }, preview: any = null

  const onMouseDown = (e: any) => {
    drawing = true; origin = getPointer(fc, e); clearSelectionOverlay()
    if (preview) { fc.remove(preview); preview = null }
    preview = new Ellipse({ left: origin.x, top: origin.y, rx: 0, ry: 0,
      fill: 'rgba(0,120,215,0.12)', stroke: '#0078d4', strokeWidth: 1,
      strokeDashArray: [4,3], selectable: false, evented: false, layerId: 'selection' } as any)
    fc.add(preview)
  }
  const onMouseMove = (e: any) => {
    if (!drawing || !preview) return
    const p = getPointer(fc, e)
    const dx = p.x - origin.x, dy = p.y - origin.y
    let rx = Math.abs(dx)/2, ry = Math.abs(dy)/2
    if (e.e.shiftKey) { rx = ry = Math.min(Math.abs(dx), Math.abs(dy))/2 }
    const cx = (dx < 0 ? origin.x - rx*2 : origin.x) + rx
    const cy = (dy < 0 ? origin.y - ry*2 : origin.y) + ry
    preview.set({ left: cx - rx, top: cy - ry, rx, ry }); fc.renderAll()
  }
  const onMouseUp = () => {
    if (!drawing || !preview) return; drawing = false
    const b = { x: Math.round(preview.left), y: Math.round(preview.top), w: Math.round(preview.rx*2), h: Math.round(preview.ry*2) }
    fc.remove(preview); preview = null
    if (b.w < 2 || b.h < 2) { fc.renderAll(); return }
    showSelectionEllipse(b)
    useEditorStore.getState().setActiveSelection({ type: 'ellipse', bounds: b, mask: null })
  }
  fc.on('mouse:down', onMouseDown); fc.on('mouse:move', onMouseMove); fc.on('mouse:up', onMouseUp)
  return () => {
    drawing = false
    if (preview) { fc.remove(preview); preview = null }
    clearSelectionOverlay()
    fc.forEachObject((o: any) => { if ('_mSel' in o) { o.selectable = o._mSel; delete o._mSel; o.evented = o._mEvt; delete o._mEvt } })
    useEditorStore.getState().clearSelection?.()
    offAll(fc, { 'mouse:down': onMouseDown, 'mouse:move': onMouseMove, 'mouse:up': onMouseUp })
  }
}

function activateMagicWand(fc: any, toolOptions: any) {
  fc.isDrawingMode = false; fc.selection = false; fc.defaultCursor = 'crosshair'
  const onMouseDown = (e: any) => {
    const p = getPointer(fc, e)
    const ctx = getLowerCtx(); if (!ctx) return
    const w = fc.width!, h = fc.height!
    const imgData = ctx.getImageData(0, 0, w, h)
    const opts = toolOptions['magic-wand'] ?? { tolerance: 32, contiguous: true }
    const { mask, bounds } = floodFill(imgData.data, w, h, Math.round(p.x), Math.round(p.y), opts.tolerance, opts.contiguous)
    useEditorStore.getState().setActiveSelection({ type: 'wand', bounds, mask })
    // Simple rect overlay showing the bounding box
    showSelectionRect(bounds)
  }
  fc.on('mouse:down', onMouseDown)
  return () => {
    clearSelectionOverlay()
    useEditorStore.getState().clearSelection?.()
    offAll(fc, { 'mouse:down': onMouseDown })
  }
}

function activateLassoPoly(fc: any) {
  fc.isDrawingMode = false; fc.selection = false; fc.defaultCursor = 'crosshair'
  let points: { x: number; y: number }[] = []
  let previewLine: any = null

  const updatePreview = (mouseX?: number, mouseY?: number) => {
    if (previewLine) { fc.remove(previewLine); previewLine = null }
    if (points.length < 1) return
    const pathParts = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const extra = mouseX !== undefined ? ` L ${mouseX} ${mouseY}` : ''
    previewLine = new Path(pathParts + extra, {
      fill: 'transparent', stroke: '#0078d4', strokeWidth: 1.5,
      strokeDashArray: [5,3], selectable: false, evented: false, layerId: 'selection'
    } as any)
    fc.add(previewLine); fc.renderAll()
  }
  const onMouseMove = (e: any) => {
    const p = getPointer(fc, e)
    updatePreview(p.x, p.y)
  }
  const onMouseDown = (e: any) => {
    const p = getPointer(fc, e)
    if (points.length > 2) {
      const first = points[0]
      const dist = Math.hypot(p.x - first.x, p.y - first.y)
      if (dist < 10) {
        // Close path
        if (previewLine) { fc.remove(previewLine); previewLine = null }
        const pathStr = points.map((pt, i) => `${i===0?'M':'L'} ${pt.x} ${pt.y}`).join(' ') + ' Z'
        showSelectionPath(pathStr)
        useEditorStore.getState().setActiveSelection({ type: 'lasso', bounds: { x:0,y:0,w:fc.width!,h:fc.height! }, mask: null })
        points = []
        return
      }
    }
    points.push(p)
    updatePreview()
  }
  const onDblClick = () => {
    if (points.length >= 3) {
      if (previewLine) { fc.remove(previewLine); previewLine = null }
      const pathStr = points.map((pt, i) => `${i===0?'M':'L'} ${pt.x} ${pt.y}`).join(' ') + ' Z'
      showSelectionPath(pathStr)
      useEditorStore.getState().setActiveSelection({ type: 'lasso', bounds: { x:0,y:0,w:fc.width!,h:fc.height! }, mask: null })
      points = []
    }
  }
  fc.on('mouse:down', onMouseDown); fc.on('mouse:move', onMouseMove); fc.on('mouse:dblclick', onDblClick)
  return () => {
    points = []
    if (previewLine) { fc.remove(previewLine); previewLine = null }
    clearSelectionOverlay()
    useEditorStore.getState().clearSelection?.()
    offAll(fc, { 'mouse:down': onMouseDown, 'mouse:move': onMouseMove, 'mouse:dblclick': onDblClick })
  }
}

function activateCloneStamp(fc: any, toolOptions: any) {
  // Clone Stamp — clean implementation using the UPPER canvas for all visual
  // indicators. The upper canvas (Fabric's event/selection overlay layer) is
  // transparent and is NEVER captured by reloadCanvasAsImage() which reads the
  // lower (rendering) canvas. This prevents crosshairs from being baked into
  // the image on Alt+click or after a stroke.

  fc.isDrawingMode = false
  fc.selection     = false
  // Reset viewport to identity in case it was drifted by old fc.setZoom() calls
  fc.setViewportTransform([1, 0, 0, 1, 0, 0])
  fc.defaultCursor = 'crosshair'

  fc.forEachObject((o: any) => {
    o._csSel = o.selectable; o._csEvt = o.evented
    o.selectable = false; o.evented = false
  })

  const opts = toolOptions['clone-stamp'] ?? { size: 30, opacity: 100 }

  let sampleOrigin:      { x: number; y: number } | null = null
  let strokeStart:       { x: number; y: number } | null = null
  let strokeSnapshot:    HTMLCanvasElement | null = null  // composite snapshot for sampling
  let strokeLayerCanvas: HTMLCanvasElement | null = null  // accumulates dabs for the active layer
  let paintLayerId:      string | null = null             // layer receiving the paint
  let isPainting       = false
  // Tracks the position of the last painted dab so we can interpolate between
  // mouse events — prevents gaps when moving the mouse quickly.
  let lastDabPos:      { x: number; y: number } | null = null

  // System layerIds that are never the paint target
  const SYSTEM_LAYER_IDS = new Set(['contour', 'selection', 'crop-overlay', 'clone-overlay'])

  // ── Upper canvas helpers — draw ONLY here, never on lower canvas ─────────
  const getUpperCtx = (): CanvasRenderingContext2D | null => {
    const upper = (fc as any).upperCanvasEl as HTMLCanvasElement | undefined
    return upper?.getContext('2d') ?? null
  }

  const clearOverlay = () => {
    const ctx = getUpperCtx()
    if (ctx) ctx.clearRect(0, 0, fc.width, fc.height)
  }

  const drawCrosshair = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, r: number,
    color: string, dashed = false
  ) => {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    if (dashed) ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - r - 4, y); ctx.lineTo(x + r + 4, y)
    ctx.moveTo(x, y - r - 4); ctx.lineTo(x, y + r + 4)
    ctx.stroke()
    ctx.restore()
  }

  const redrawSourceTarget = () => {
    if (!sampleOrigin) return
    const ctx = getUpperCtx()
    if (!ctx) return
    clearOverlay()
    // White dashed crosshair at the fixed sample origin
    drawCrosshair(ctx, sampleOrigin.x, sampleOrigin.y, 10, 'rgba(255,255,255,0.9)', true)
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  const onMouseDown = (e: any) => {
    // Prevent browser alt-key default (menu bar focus, system zoom, etc.)
    if (e.e.altKey) e.e.preventDefault()

    if (e.e.altKey) {
      sampleOrigin = getPointer(fc, e)
      redrawSourceTarget()
      fc.defaultCursor = 'copy'
      return
    }

    if (!sampleOrigin) {
      fc.defaultCursor = 'not-allowed'
      return
    }

    isPainting  = true
    strokeStart = getPointer(fc, e)
    fc.defaultCursor = 'crosshair'

    // Snapshot the COMPOSITE lower canvas — used for sampling (what to clone from)
    const lowerEl = getLowerCanvasEl()
    if (lowerEl) {
      strokeSnapshot = document.createElement('canvas')
      strokeSnapshot.width  = lowerEl.width
      strokeSnapshot.height = lowerEl.height
      strokeSnapshot.getContext('2d')!.drawImage(lowerEl, 0, 0)
    }

    // Determine which layer receives the paint
    const { activeLayerId } = useEditorStore.getState()
    paintLayerId = activeLayerId

    // strokeLayerCanvas accumulates dabs for this layer only.
    // Seed it with the active layer's existing pixel content so painting over
    // a non-empty layer correctly composites onto what's already there.
    strokeLayerCanvas = document.createElement('canvas')
    strokeLayerCanvas.width  = fc.width
    strokeLayerCanvas.height = fc.height
    const activeLayerObj = fc.getObjects().find(
      (o: any) => o.layerId === paintLayerId && !SYSTEM_LAYER_IDS.has(o.layerId)
    ) as any
    if (activeLayerObj) {
      const el = activeLayerObj._element ?? activeLayerObj.getElement?.()
      if (el) {
        strokeLayerCanvas.getContext('2d')!.drawImage(
          el,
          activeLayerObj.left ?? 0,
          activeLayerObj.top  ?? 0
        )
      }
    }

    // Initialise the interpolation cursor to the stroke start position
    lastDabPos = { x: strokeStart!.x, y: strokeStart!.y }
  }

  const paintDab = (
    ctx: CanvasRenderingContext2D,
    dstX: number, dstY: number,
    r: number, alpha: number
  ) => {
    if (!sampleOrigin || !strokeStart || !strokeSnapshot) return
    const offsetX = dstX - strokeStart.x
    const offsetY = dstY - strokeStart.y
    const srcX = Math.round(sampleOrigin.x + offsetX)
    const srcY = Math.round(sampleOrigin.y + offsetY)

    const drawDab = (target: CanvasRenderingContext2D) => {
      target.save()
      target.globalAlpha = alpha
      target.beginPath(); target.arc(dstX, dstY, r, 0, Math.PI * 2); target.clip()
      target.drawImage(strokeSnapshot!, srcX - r, srcY - r, r * 2, r * 2, dstX - r, dstY - r, r * 2, r * 2)
      target.restore()
    }

    // Paint to the lower canvas for real-time visual feedback
    drawDab(ctx)

    // Also paint to the layer canvas — this is what gets committed to the
    // active layer on mouse:up, keeping it independent of other layers.
    const layerCtx = strokeLayerCanvas?.getContext('2d')
    if (layerCtx) drawDab(layerCtx)
  }

  const onMouseMove = (e: any) => {
    if (!isPainting || !sampleOrigin || !strokeStart || !strokeSnapshot) return

    const p   = getPointer(fc, e)
    const ctx = getLowerCtx()
    if (!ctx) return

    const r     = Math.round((opts.size ?? 30) / 2)
    const alpha = (opts.opacity ?? 100) / 100

    // ── Interpolation: fill gaps when mouse moves faster than event rate ──────
    // Paint dabs every `step` pixels along the line from lastDabPos to p.
    // Step = 25% of radius → ~4 dabs per radius → visually seamless at any speed.
    const from  = lastDabPos ?? { x: p.x, y: p.y }
    const dx    = p.x - from.x
    const dy    = p.y - from.y
    const dist  = Math.hypot(dx, dy)
    const step  = Math.max(1, r * 0.25)
    const steps = dist < step ? 1 : Math.ceil(dist / step)

    for (let i = 1; i <= steps; i++) {
      const t    = i / steps
      const dabX = Math.round(from.x + dx * t)
      const dabY = Math.round(from.y + dy * t)
      paintDab(ctx, dabX, dabY, r, alpha)
    }

    lastDabPos = { x: p.x, y: p.y }

    // ── Overlay: source crosshair tracks the current source offset ────────────
    const offsetX = p.x - strokeStart.x
    const offsetY = p.y - strokeStart.y
    const srcX    = Math.round(sampleOrigin.x + offsetX)
    const srcY    = Math.round(sampleOrigin.y + offsetY)
    const uctx = getUpperCtx()
    if (uctx) {
      clearOverlay()
      drawCrosshair(uctx, sampleOrigin.x, sampleOrigin.y, 10, 'rgba(255,255,255,0.85)', true)
      drawCrosshair(uctx, srcX, srcY, r, 'rgba(255,210,0,0.8)')
    }
  }

  const onMouseUp = async () => {
    if (!isPainting) return
    isPainting     = false
    strokeSnapshot = null
    lastDabPos     = null

    clearOverlay()

    // ── Commit stroke to the active layer only ────────────────────────────────
    // strokeLayerCanvas holds all dabs painted during this stroke on top of
    // whatever content the active layer already had. We replace only that
    // layer's FabricImage — other layers are untouched.
    const targetId = paintLayerId
    const layerSnap = strokeLayerCanvas
    strokeLayerCanvas = null
    paintLayerId = null

    if (layerSnap && targetId) {
      const blob = await new Promise<Blob>(res => layerSnap.toBlob(b => res(b!), 'image/png'))
      const dataURL = await new Promise<string>(res => {
        const fr = new FileReader()
        fr.onload = e => res(e.target!.result as string)
        fr.readAsDataURL(blob)
      })

      setSuppressHistoryBridge(true)
      try {
        const { FabricImage: FI } = await import('fabric')
        // Remove existing FabricImage(s) for this layer
        fc.getObjects()
          .filter((o: any) => o.layerId === targetId && !SYSTEM_LAYER_IDS.has(o.layerId))
          .forEach((o: any) => fc.remove(o))

        const img = await FI.fromURL(dataURL)
        img.set({ left: 0, top: 0, selectable: false, evented: false, layerId: targetId } as any)
        fc.add(img)
        fc.sendObjectToBack(img as any)
        fc.renderAll()
      } finally {
        setSuppressHistoryBridge(false)
      }

      useEditorStore.getState().pushHistory('Clone Stamp', fc.toJSON(['customId', 'layerId']))
    }

    redrawSourceTarget()
    fc.defaultCursor = 'copy'
  }

  fc.on('mouse:down', onMouseDown)
  fc.on('mouse:move', onMouseMove)
  fc.on('mouse:up',   onMouseUp)

  return () => {
    isPainting        = false
    sampleOrigin      = null
    strokeStart       = null
    strokeSnapshot    = null
    strokeLayerCanvas = null
    paintLayerId      = null
    lastDabPos        = null
    clearOverlay()
    fc.defaultCursor = 'default'
    fc.forEachObject((o: any) => {
      if ('_csSel' in o) { o.selectable = o._csSel; delete o._csSel }
      if ('_csEvt' in o) { o.evented    = o._csEvt; delete o._csEvt }
    })
    offAll(fc, { 'mouse:down': onMouseDown, 'mouse:move': onMouseMove, 'mouse:up': onMouseUp })
  }
}

function makeToneBrush(toolId: string, brightnessFactor: (exposure: number) => number) {
  return function(fc: any, toolOptions: any) {
    const opts = toolOptions[toolId] ?? { size: 30, exposure: 50 }
    fc.isDrawingMode = true; fc.selection = false
    const brush = new PencilBrush(fc)
    brush.color = 'rgba(0,0,0,0.01)'; brush.width = opts.size
    fc.freeDrawingBrush = brush

    let altOnStroke = false
    let shiftOnStroke = false
    const onStrokeStart = (e: any) => {
      altOnStroke = e.e.altKey
      shiftOnStroke = e.e.shiftKey
    }
    fc.on('mouse:down', onStrokeStart)

    const onPathCreated = async (e: any) => {
      fc.remove(e.path)
      const ctx = getLowerCtx(); if (!ctx) return
      const path = e.path
      const coords = (path.path || []) as [string, number, number][]
      const r = Math.round(opts.size / 2)
      // Alt inverts: dodge ↔ burn; Shift doubles strength
      const strength = shiftOnStroke ? 2 : 1
      let factor = brightnessFactor(opts.exposure * strength)
      if (altOnStroke) factor = 1 / factor  // invert: >1 becomes <1 and vice-versa
      for (const [cmd, cx, cy] of coords) {
        if (cmd === 'M' || cmd === 'L') {
          const x = Math.max(0, Math.round(cx - r)), y = Math.max(0, Math.round(cy - r))
          const imgData = ctx.getImageData(x, y, r*2, r*2)
          for (let i = 0; i < imgData.data.length; i+=4) {
            imgData.data[i]   = Math.min(255, Math.max(0, imgData.data[i]   * factor))
            imgData.data[i+1] = Math.min(255, Math.max(0, imgData.data[i+1] * factor))
            imgData.data[i+2] = Math.min(255, Math.max(0, imgData.data[i+2] * factor))
          }
          ctx.putImageData(imgData, x, y)
        }
      }
      await reloadCanvasAsImage()
      useEditorStore.getState().pushHistory(toolId, fc.toJSON(['customId','layerId']))
    }

    fc.on('path:created', onPathCreated)
    return () => { fc.isDrawingMode = false; fc.off('mouse:down', onStrokeStart); fc.off('path:created', onPathCreated) }
  }
}

const activateDodge = makeToneBrush('dodge', (exp) => 1 + (exp/100) * 0.6)
const activateBurn  = makeToneBrush('burn',  (exp) => 1 - (exp/100) * 0.4)

function activateBlurBrush(fc: any, toolOptions: any) {
  const opts = toolOptions['blur-brush'] ?? { size: 30, strength: 50 }
  fc.isDrawingMode = true; fc.selection = false
  const brush = new PencilBrush(fc)
  brush.color = 'rgba(0,0,0,0.01)'; brush.width = opts.size
  fc.freeDrawingBrush = brush

  let altOnStroke = false
  let shiftOnStroke = false
  const onStrokeStart = (e: any) => { altOnStroke = e.e.altKey; shiftOnStroke = e.e.shiftKey }
  fc.on('mouse:down', onStrokeStart)

  const onPathCreated = async (e: any) => {
    fc.remove(e.path)
    const ctx = getLowerCtx(); if (!ctx) return
    const path = e.path
    const coords = (path.path || []) as [string, number, number][]
    const r = Math.round(opts.size / 2)
    const sharpenMode = altOnStroke || shiftOnStroke
    for (const [cmd, cx, cy] of coords) {
      if (cmd === 'M' || cmd === 'L') {
        const x = Math.max(0, Math.round(cx - r)), y = Math.max(0, Math.round(cy - r))
        const imgData = ctx.getImageData(x, y, r*2, r*2)
        if (sharpenMode) {
          // Unsharp mask (sharpen)
          const s = (opts.strength / 100) * 0.5
          const orig = new Uint8ClampedArray(imgData.data)
          const size = r * 2
          for (let iy = 1; iy < size-1; iy++) {
            for (let ix = 1; ix < size-1; ix++) {
              for (let c = 0; c < 3; c++) {
                const center = orig[(iy*size+ix)*4+c]
                const sum = orig[((iy-1)*size+ix)*4+c] + orig[((iy+1)*size+ix)*4+c] +
                            orig[(iy*size+ix-1)*4+c] + orig[(iy*size+ix+1)*4+c]
                imgData.data[(iy*size+ix)*4+c] = Math.min(255, Math.max(0,
                  center + s * (center * 4 - sum)
                ))
              }
            }
          }
        } else {
          boxBlur(imgData.data, r*2, r*2, Math.max(1, Math.round((opts.strength/100)*3)))
        }
        ctx.putImageData(imgData, x, y)
      }
    }
    await reloadCanvasAsImage()
    useEditorStore.getState().pushHistory('Blur/Sharpen Brush', fc.toJSON(['customId','layerId']))
  }

  fc.on('path:created', onPathCreated)
  return () => { fc.isDrawingMode = false; fc.off('mouse:down', onStrokeStart); fc.off('path:created', onPathCreated) }
}

function activatePaintBucket(fc: any, toolOptions: any, storeActions: any) {
  fc.isDrawingMode = false; fc.selection = false; fc.defaultCursor = 'crosshair'

  const onMouseDown = async (e: any) => {
    const p = getPointer(fc, e)
    const ctx = getLowerCtx(); if (!ctx) return
    const w = fc.width!, h = fc.height!
    const imgData = ctx.getImageData(0, 0, w, h)
    const opts = toolOptions['paint-bucket'] ?? { tolerance: 32, contiguous: true }
    const { mask } = floodFill(imgData.data, w, h, Math.round(p.x), Math.round(p.y), opts.tolerance, opts.contiguous)
    const fg = useEditorStore.getState().foregroundColor ?? '#000000'
    const [r, g, b] = hexToRgbArr(fg)
    applyMaskFill(ctx, mask, w, h, r, g, b, 255)
    await reloadCanvasAsImage()
    useEditorStore.getState().pushHistory('Paint Bucket', fc.toJSON(['customId','layerId']))
  }

  fc.on('mouse:down', onMouseDown)
  return () => { fc.defaultCursor = 'default'; offAll(fc, { 'mouse:down': onMouseDown }) }
}

function activateGradient(fc: any, toolOptions: any, storeActions: any) {
  fc.isDrawingMode = false; fc.selection = false; fc.defaultCursor = 'crosshair'
  let startPt: { x: number; y: number } | null = null
  let previewLine: any = null

  const onMouseDown = (e: any) => {
    startPt = getPointer(fc, e)
    if (previewLine) { fc.remove(previewLine); previewLine = null }
    previewLine = new Line([startPt.x, startPt.y, startPt.x, startPt.y], {
      stroke: '#0078d4', strokeWidth: 1.5, strokeDashArray: [5,3],
      selectable: false, evented: false
    } as any)
    fc.add(previewLine)
  }
  const onMouseMove = (e: any) => {
    if (!startPt || !previewLine) return
    const p = getPointer(fc, e)
    previewLine.set({ x2: p.x, y2: p.y }); fc.renderAll()
  }
  const onMouseUp = async (e: any) => {
    if (!startPt) return
    const endPt = getPointer(fc, e)
    if (previewLine) { fc.remove(previewLine); previewLine = null }
    fc.renderAll()

    const ctx = getLowerCtx(); if (!ctx) return
    const w = fc.width!, h = fc.height!
    const fg = useEditorStore.getState().foregroundColor ?? '#000000'
    const opts = toolOptions.gradient ?? { type: 'linear', opacity: 100 }

    const off = document.createElement('canvas'); off.width = w; off.height = h
    const octx = off.getContext('2d')!
    octx.drawImage(fc.getElement() as HTMLCanvasElement, 0, 0)

    const grad = opts.type === 'radial'
      ? octx.createRadialGradient(startPt.x, startPt.y, 0, startPt.x, startPt.y, Math.hypot(endPt.x-startPt.x, endPt.y-startPt.y))
      : octx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y)
    grad.addColorStop(0, fg)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    octx.globalAlpha = (opts.opacity ?? 100) / 100
    octx.fillStyle = grad
    octx.fillRect(0, 0, w, h)

    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(off, 0, 0)
    await reloadCanvasAsImage()
    useEditorStore.getState().pushHistory('Gradient', fc.toJSON(['customId','layerId']))
    startPt = null
  }
  fc.on('mouse:down', onMouseDown); fc.on('mouse:move', onMouseMove); fc.on('mouse:up', onMouseUp)
  return () => {
    startPt = null
    if (previewLine) { fc.remove(previewLine); previewLine = null }
    fc.defaultCursor = 'default'
    offAll(fc, { 'mouse:down': onMouseDown, 'mouse:move': onMouseMove, 'mouse:up': onMouseUp })
  }
}

function activatePen(fc: any, toolOptions: any) {
  fc.isDrawingMode = false; fc.selection = false; fc.defaultCursor = 'crosshair'
  fc.forEachObject((o: any) => { o._penSaved = { s: o.selectable, e: o.evented }; o.selectable = false; o.evented = false })

  const opts = toolOptions.pen ?? { stroke: '#000000', strokeWidth: 2, fill: 'transparent' }

  interface PenPoint { x: number; y: number }
  let points: PenPoint[] = []
  let previewPath: any = null
  let handles: any[] = []
  let isDragging = false
  let dragHandle: any = null

  const buildSVGPath = (pts: PenPoint[], closed = false) => {
    if (pts.length === 0) return ''
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (closed ? ' Z' : '')
  }

  const updatePreview = (mouseX?: number, mouseY?: number) => {
    if (previewPath) { fc.remove(previewPath); previewPath = null }
    if (points.length === 0) return
    let d = buildSVGPath(points)
    if (mouseX !== undefined) d += ` L ${mouseX} ${mouseY}`
    previewPath = new Path(d, {
      fill: 'transparent', stroke: opts.stroke, strokeWidth: opts.strokeWidth,
      strokeDashArray: [5,3], selectable: false, evented: false
    } as any)
    fc.add(previewPath); fc.renderAll()
  }

  const finalize = (closed: boolean) => {
    if (previewPath) { fc.remove(previewPath); previewPath = null }
    handles.forEach(h => fc.remove(h)); handles = []
    if (points.length < 2) { points = []; fc.renderAll(); return }
    const d = buildSVGPath(points, closed)
    const finalPath = new Path(d, {
      stroke: opts.stroke, strokeWidth: opts.strokeWidth,
      fill: closed ? opts.fill : 'transparent',
      selectable: true, evented: true
    } as any)
    fc.add(finalPath)
    fc.forEachObject((o: any) => { if (o._penSaved) { o.selectable = o._penSaved.s; o.evented = o._penSaved.e; delete o._penSaved } })
    fc.setActiveObject(finalPath); fc.renderAll()
    useEditorStore.getState().pushHistory('Pen Path', fc.toJSON(['customId','layerId']))
    points = []
  }

  const onMouseDown = (e: any) => {
    const p = getPointer(fc, e)
    if (points.length > 1) {
      const first = points[0]
      if (Math.hypot(p.x - first.x, p.y - first.y) < 10) { finalize(true); return }
    }
    points.push(p)
    // Show anchor dot
    const dot = new Circle({ left: p.x-4, top: p.y-4, radius: 4,
      fill: '#0078d4', stroke: '#fff', strokeWidth: 1,
      selectable: false, evented: false } as any)
    handles.push(dot); fc.add(dot)
    updatePreview()
  }
  const onMouseMove = (e: any) => {
    const p = getPointer(fc, e); updatePreview(p.x, p.y)
  }

  // Escape or Enter: finalize
  const keyHandler = (ev: KeyboardEvent) => {
    if (ev.key === 'Enter') { finalize(false) }
    if (ev.key === 'Escape') {
      if (previewPath) { fc.remove(previewPath); previewPath = null }
      handles.forEach(h => fc.remove(h)); handles = []
      points = []; fc.renderAll()
    }
  }
  document.addEventListener('keydown', keyHandler, { capture: true })

  fc.on('mouse:down', onMouseDown); fc.on('mouse:move', onMouseMove)
  return () => {
    if (previewPath) { fc.remove(previewPath); previewPath = null }
    handles.forEach(h => fc.remove(h)); handles = []
    points = []; fc.defaultCursor = 'default'
    fc.forEachObject((o: any) => { if (o._penSaved) { o.selectable = o._penSaved.s; o.evented = o._penSaved.e; delete o._penSaved } })
    document.removeEventListener('keydown', keyHandler, { capture: true })
    offAll(fc, { 'mouse:down': onMouseDown, 'mouse:move': onMouseMove })
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
    case 'line':
      disposer = activateLine(fc, toolOptions)
      break
    case 'rounded-rect':
      disposer = activateRoundedRect(fc, toolOptions)
      break
    case 'polygon':
      disposer = activatePolygon(fc, toolOptions)
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
    case 'marquee-rect':    disposer = activateMarqueeRect(fc); break
    case 'marquee-ellipse': disposer = activateMarqueeEllipse(fc); break
    case 'magic-wand':      disposer = activateMagicWand(fc, toolOptions); break
    case 'lasso-poly':      disposer = activateLassoPoly(fc); break
    case 'clone-stamp': disposer = activateCloneStamp(fc, toolOptions); break
    case 'dodge':       disposer = activateDodge(fc, toolOptions); break
    case 'burn':        disposer = activateBurn(fc, toolOptions); break
    case 'blur-brush':  disposer = activateBlurBrush(fc, toolOptions); break
    case 'paint-bucket': disposer = activatePaintBucket(fc, toolOptions, storeActions); break
    case 'gradient': disposer = activateGradient(fc, toolOptions, storeActions); break
    case 'pen': disposer = activatePen(fc, toolOptions); break
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
