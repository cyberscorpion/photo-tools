import { useEffect, useRef } from 'react'
import { useEditorStore } from '../store/editorStore.js'
import { getFabric } from '../canvas/fabricManager.js'
import { confirmCrop, cancelCrop } from '../canvas/toolHandlers.js'
import { getLowerCtx, reloadCanvasAsImage, applyMaskErase } from '../utils/canvasOps.js'

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

      // Alt key alone (no other modifier) — prevent browser default when
      // clone stamp is active so Alt+click sets source without triggering the
      // browser menu bar, accessibility zoom, or other OS-level Alt behaviour.
      if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const { activeTool } = useEditorStore.getState()
        if (activeTool === 'clone-stamp') e.preventDefault()
      }

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
          case 'c':
            e.preventDefault()
            import('../canvas/clipboard.ts').then(({ copySelected }) => copySelected())
            return
          case 'x':
            e.preventDefault()
            import('../canvas/clipboard.ts').then(({ cutSelected }) => cutSelected())
            return
          case 'v':
            e.preventDefault()
            import('../canvas/clipboard.ts').then(({ pasteClipboard }) => pasteClipboard())
            return
          case 'd':
            e.preventDefault()
            import('../canvas/clipboard.ts').then(({ duplicateSelected }) => duplicateSelected())
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
          case 'g':
            e.preventDefault()
            ;(async () => {
              const fc = getFabric()
              if (!fc) return
              const active = fc.getActiveObjects()
              if (active.length < 2) return
              const { Group } = await import('fabric')
              const group = new Group(active, { selectable: true, evented: true } as any)
              active.forEach((o: any) => fc.remove(o))
              fc.discardActiveObject()
              fc.add(group as any)
              fc.setActiveObject(group as any)
              fc.renderAll()
              useEditorStore.getState().pushHistory('Group', fc.toJSON(['customId', 'layerId']))
            })()
            return
          case 'e':
            if (e.shiftKey) {
              // Ctrl+Shift+E: flatten visible layers to one image
              e.preventDefault()
              ;(async () => {
                const fc = getFabric()
                if (!fc) return
                await reloadCanvasAsImage()
                useEditorStore.getState().pushHistory('Flatten', fc.toJSON(['customId', 'layerId']))
              })()
              return
            }
            return
          case 'n':
            if (e.shiftKey) {
              e.preventDefault()
              useEditorStore.getState().addLayer('Layer ' + (useEditorStore.getState().layers.length + 1))
              return
            }
            return
          default:
            return
        }
      }

      // ── Everything below requires no HTML input focus ───────────────────────
      if (isHtmlInput) return

      const { cropMode, toolOptions } = useEditorStore.getState()

      // Alt+Delete: fill canvas with foreground color
      if (key === 'delete' && e.altKey) {
        e.preventDefault()
        const { foregroundColor } = useEditorStore.getState()
        const fc = getFabric()
        if (fc) {
          const ctx = getLowerCtx()
          if (ctx) {
            ctx.fillStyle = foregroundColor
            ctx.fillRect(0, 0, fc.width!, fc.height!)
            reloadCanvasAsImage().then(() => {
              useEditorStore.getState().pushHistory('Fill FG', fc.toJSON(['customId', 'layerId']))
            })
          }
        }
        return
      }

      // Ctrl+Backspace: fill canvas with background color
      if ((key === 'backspace') && ctrl) {
        e.preventDefault()
        const { backgroundColor } = useEditorStore.getState()
        const fc = getFabric()
        if (fc) {
          const ctx = getLowerCtx()
          if (ctx) {
            ctx.fillStyle = backgroundColor
            ctx.fillRect(0, 0, fc.width!, fc.height!)
            reloadCanvasAsImage().then(() => {
              useEditorStore.getState().pushHistory('Fill BG', fc.toJSON(['customId', 'layerId']))
            })
          }
        }
        return
      }

      // Tab: toggle all panels visibility
      if (key === 'tab') {
        e.preventDefault()
        const { panels, togglePanel } = useEditorStore.getState()
        const anyOpen = Object.values(panels).some(Boolean)
        if (anyOpen) {
          Object.keys(panels).forEach(p => {
            if ((panels as Record<string, boolean>)[p]) togglePanel(p)
          })
        } else {
          ;['layers', 'adjustments'].forEach(p => togglePanel(p))
        }
        return
      }

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

      // Delete / Backspace: erase active pixel selection, or remove selected Fabric objects
      if (key === 'delete' || key === 'backspace') {
        const { activeSelection } = useEditorStore.getState()
        if (activeSelection) {
          e.preventDefault()
          const ctx = getLowerCtx()
          if (fc && ctx) {
            const w = fc.width!, h = fc.height!
            const activeMask = activeSelection.featheredMask ?? activeSelection.mask
            if (activeMask) {
              applyMaskErase(ctx, activeMask, w, h)
            } else {
              const { x, y, w: bw, h: bh } = activeSelection.bounds
              ctx.save()
              ctx.globalCompositeOperation = 'destination-out'
              ctx.fillStyle = 'rgba(0,0,0,1)'
              ctx.fillRect(x, y, bw, bh)
              ctx.restore()
            }
            reloadCanvasAsImage().then(() => {
              useEditorStore.getState().pushHistory('Delete Selection', fc.toJSON(['customId', 'layerId']))
            })
          }
          return
        }
        // No pixel selection — remove selected Fabric objects
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
