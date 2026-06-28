import { useEffect, useRef } from 'react'
import { useEditorStore } from '../store/editorStore.js'
import { getFabric } from '../canvas/fabricManager.js'
import { confirmCrop, cancelCrop } from '../canvas/toolHandlers.js'

const TOOL_SHORTCUTS = {
  v: 'select', b: 'brush', e: 'eraser', t: 'text',
  r: 'rect',   o: 'ellipse', h: 'hand', z: 'zoom',
  c: 'crop',   i: 'eyedropper', l: 'lasso',
}

export function useKeyboardShortcuts() {
  // Only stable store action refs — NOT volatile state.
  // Volatile values (zoom, cropMode, toolOptions) are read inside the
  // handler via getState() so they're always fresh without requiring the
  // listener to be re-registered.
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const undo          = useEditorStore((s) => s.undo)
  const redo          = useEditorStore((s) => s.redo)
  const setZoom       = useEditorStore((s) => s.setZoom)
  const setToolOption = useEditorStore((s) => s.setToolOption)

  const prevToolRef    = useRef(null)
  const spaceActiveRef = useRef(false)

  useEffect(() => {
    const handleKeyDown = (e) => {
      const fc  = getFabric()
      const key = e.key.toLowerCase()

      // ── While Fabric IText is in edit mode: only intercept Escape ────────────
      if (fc?.getActiveObject()?.isEditing) {
        if (key === 'escape') {
          e.preventDefault()
          fc.getActiveObject().exitEditing?.()
          fc.discardActiveObject()
          fc.renderAll()
        }
        return  // Let Fabric / the browser handle everything else
      }

      const tag         = e.target.tagName
      const isHtmlInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable
      const ctrl        = e.ctrlKey || e.metaKey

      // ── Escape: always cancel crop or deselect (regardless of focus) ────────
      if (key === 'escape') {
        e.preventDefault()
        const { cropMode } = useEditorStore.getState()
        if (cropMode) { cancelCrop(); return }
        if (fc) { fc.discardActiveObject(); fc.renderAll() }
        return
      }

      // ── Enter: confirm crop (regardless of focus) ───────────────────────────
      if (key === 'enter' && useEditorStore.getState().cropMode) {
        e.preventDefault()
        confirmCrop()
        return
      }

      // ── Ctrl+ shortcuts ─────────────────────────────────────────────────────
      // Ctrl+Z / Ctrl+Y always work, even when an HTML input has focus.
      // Other Ctrl+ shortcuts are blocked while an input is focused so the
      // browser can still handle Ctrl+A (select all text) etc.
      if (ctrl) {
        switch (key) {
          case 'z':
            e.preventDefault()
            if (e.shiftKey) redo(); else undo()
            return
          case 'y':
            e.preventDefault()
            redo()
            return
          default:
            break
        }
        // Remaining Ctrl+ shortcuts require no HTML input focus
        if (isHtmlInput) return
        switch (key) {
          case 's':
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('photo-tools:open-export'))
            return
          case 'a':
            e.preventDefault()
            ;(async () => {
              const { ActiveSelection } = await import('fabric')
              const objs = fc?.getObjects()
              if (!objs?.length) return
              fc.discardActiveObject()
              fc.setActiveObject(new ActiveSelection(objs, { canvas: fc }))
              fc.requestRenderAll()
            })()
            return
          case 'd':
            e.preventDefault()
            if (fc) { fc.discardActiveObject(); fc.renderAll() }
            return
          case '=':
          case '+': {
            e.preventDefault()
            const cur = useEditorStore.getState().zoom
            setZoom(Math.min(16, parseFloat((cur * 1.2).toFixed(3))))
            return
          }
          case '-': {
            e.preventDefault()
            const cur = useEditorStore.getState().zoom
            setZoom(Math.max(0.05, parseFloat((cur / 1.2).toFixed(3))))
            return
          }
          case '0':
            e.preventDefault()
            setZoom(1)
            return
          case 't':
            // Ctrl+T: new tab
            e.preventDefault()
            useEditorStore.getState().addTab?.()
            return
          default:
            return
        }
      }

      // ── Everything below requires no HTML input focus ───────────────────────
      if (isHtmlInput) return

      const { cropMode, toolOptions } = useEditorStore.getState()

      // Fit to screen
      if (key === 'f') { setZoom(1); return }

      // Space: temporary hand tool (held)
      if (key === ' ' && !spaceActiveRef.current) {
        e.preventDefault()
        spaceActiveRef.current = true
        prevToolRef.current = useEditorStore.getState().activeTool
        setActiveTool('hand')
        return
      }

      // Tool shortcuts (disabled during crop mode)
      if (!cropMode && TOOL_SHORTCUTS[key]) {
        setActiveTool(TOOL_SHORTCUTS[key])
        return
      }

      // Brush size: [ and ]
      if (key === '[') {
        setToolOption('brush', 'size', Math.max(1, toolOptions.brush.size - 5))
        return
      }
      if (key === ']') {
        setToolOption('brush', 'size', Math.min(200, toolOptions.brush.size + 5))
        return
      }

      // Arrow keys: nudge selected object
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
        const obj = fc?.getActiveObject()
        if (!obj || obj.isEditing) return
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const delta = {
          arrowleft:  { left: (obj.left  || 0) - step },
          arrowright: { left: (obj.left  || 0) + step },
          arrowup:    { top:  (obj.top   || 0) - step },
          arrowdown:  { top:  (obj.top   || 0) + step },
        }[key]
        obj.set(delta)
        obj.setCoords()
        fc.renderAll()
        return
      }

      // Delete / Backspace: remove selected objects
      if (key === 'delete' || key === 'backspace') {
        const obj = fc?.getActiveObject()
        if (obj && !obj.isEditing) {
          fc.getActiveObjects().forEach((o) => fc.remove(o))
          fc.discardActiveObject()
          fc.renderAll()
        }
      }
    }

    const handleKeyUp = (e) => {
      // Release space → restore previous tool
      if (e.key === ' ' && spaceActiveRef.current) {
        spaceActiveRef.current = false
        const restore = prevToolRef.current || 'select'
        prevToolRef.current = null
        setActiveTool(restore)
      }
    }

    // ── Capture phase on document ────────────────────────────────────────────
    // This fires BEFORE any stopPropagation() call can hide the event from a
    // bubble-phase window listener — the previous source of "shortcuts stop
    // working" after clicking the canvas or certain panels.
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    document.addEventListener('keyup',   handleKeyUp,   { capture: true })

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true })
      document.removeEventListener('keyup',   handleKeyUp,   { capture: true })
    }
  // Volatile state (zoom, cropMode, toolOptions) read via getState() inside
  // the handler — stable action refs only in deps so the listener is registered
  // exactly once per mount, never bouncing on zoom/slider changes.
  }, [setActiveTool, undo, redo, setZoom, setToolOption])
}
