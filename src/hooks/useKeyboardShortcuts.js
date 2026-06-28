import { useEffect, useRef } from 'react'
import { useEditorStore } from '../store/editorStore.js'
import { getFabric } from '../canvas/fabricManager.js'
import { confirmCrop, cancelCrop } from '../canvas/toolHandlers.js'

const TOOL_SHORTCUTS = {
  v: 'select', b: 'brush', e: 'eraser', t: 'text',
  r: 'rect', o: 'ellipse', h: 'hand', z: 'zoom',
  c: 'crop', i: 'eyedropper', l: 'lasso',
}

export function useKeyboardShortcuts() {
  const { setActiveTool, undo, redo, zoom, setZoom, toolOptions, setToolOption, cropMode } = useEditorStore()
  const prevToolRef = useRef(null)
  const spaceActiveRef = useRef(false)

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return

      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      // Escape: cancel crop or deselect
      if (key === 'escape') {
        e.preventDefault()
        if (cropMode) { cancelCrop(); return }
        const fc = getFabric()
        if (fc) { fc.discardActiveObject(); fc.renderAll() }
        return
      }

      // Enter: confirm crop
      if (key === 'enter' && cropMode) {
        e.preventDefault()
        confirmCrop()
        return
      }

      // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
      if (ctrl && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if (ctrl && key === 'y') { e.preventDefault(); redo(); return }

      // Ctrl+S: open export
      if (ctrl && key === 's') {
        e.preventDefault()
        // Dispatch a custom event that ExportDialog listens for
        window.dispatchEvent(new CustomEvent('photo-tools:open-export'))
        return
      }

      // Ctrl+A: select all
      if (ctrl && key === 'a') {
        e.preventDefault()
        const fc = getFabric()
        if (!fc) return
        import('fabric').then(({ ActiveSelection }) => {
          const objs = fc.getObjects()
          if (!objs.length) return
          fc.discardActiveObject()
          const sel = new ActiveSelection(objs, { canvas: fc })
          fc.setActiveObject(sel)
          fc.requestRenderAll()
        })
        return
      }

      // Ctrl+D: deselect
      if (ctrl && key === 'd') {
        e.preventDefault()
        const fc = getFabric()
        if (fc) { fc.discardActiveObject(); fc.renderAll() }
        return
      }

      // Ctrl+= / Ctrl++: zoom in
      if (ctrl && (key === '=' || key === '+')) {
        e.preventDefault()
        setZoom(Math.min(16, parseFloat((zoom * 1.2).toFixed(3))))
        return
      }
      // Ctrl+-: zoom out
      if (ctrl && key === '-') {
        e.preventDefault()
        setZoom(Math.max(0.05, parseFloat((zoom / 1.2).toFixed(3))))
        return
      }
      // Ctrl+0: 100% zoom
      if (ctrl && key === '0') {
        e.preventDefault()
        setZoom(1)
        return
      }

      // F: fit image to screen (zoom to a reasonable default)
      if (key === 'f' && !ctrl) {
        setZoom(1)
        return
      }

      // Space: temporary hand tool
      if (key === ' ' && !spaceActiveRef.current) {
        e.preventDefault()
        spaceActiveRef.current = true
        prevToolRef.current = useEditorStore.getState().activeTool
        setActiveTool('hand')
        return
      }

      // Tool shortcuts (only when not in crop mode)
      if (!cropMode && !ctrl && TOOL_SHORTCUTS[key]) {
        setActiveTool(TOOL_SHORTCUTS[key])
        return
      }

      // [ and ]: brush size
      if (key === '[') {
        const cur = toolOptions.brush.size
        setToolOption('brush', 'size', Math.max(1, cur - 5))
        return
      }
      if (key === ']') {
        const cur = toolOptions.brush.size
        setToolOption('brush', 'size', Math.min(200, cur + 5))
        return
      }

      // Arrow keys: nudge selected object (1px, Shift = 10px)
      if (key === 'arrowleft' || key === 'arrowright' || key === 'arrowup' || key === 'arrowdown') {
        const fc = getFabric()
        const obj = fc?.getActiveObject()
        if (!obj || obj.isEditing) return
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const delta = {
          arrowleft:  { left: (obj.left || 0) - step },
          arrowright: { left: (obj.left || 0) + step },
          arrowup:    { top:  (obj.top  || 0) - step },
          arrowdown:  { top:  (obj.top  || 0) + step },
        }[key]
        obj.set(delta)
        obj.setCoords()
        fc.renderAll()
        return
      }

      // Delete / Backspace: remove selected objects
      if (key === 'delete' || key === 'backspace') {
        const fc = getFabric()
        const obj = fc?.getActiveObject()
        if (obj && !obj.isEditing) {
          fc.getActiveObjects().forEach((o) => fc.remove(o))
          fc.discardActiveObject()
          fc.renderAll()
        }
      }
    }

    const handleKeyUp = (e) => {
      if (e.key === ' ' && spaceActiveRef.current) {
        spaceActiveRef.current = false
        const restore = prevToolRef.current || 'select'
        prevToolRef.current = null
        setActiveTool(restore)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [setActiveTool, undo, redo, zoom, setZoom, toolOptions, setToolOption, cropMode])
}
