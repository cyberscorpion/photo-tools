import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore.js'
import { getFabric } from '../canvas/fabricManager.js'

const TOOL_SHORTCUTS = { v:'select', b:'brush', e:'eraser', t:'text', r:'rect', o:'ellipse', h:'hand', z:'zoom', c:'crop', i:'eyedropper', l:'lasso' }

export function useKeyboardShortcuts() {
  const { setActiveTool, undo, redo } = useEditorStore()

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
      const key = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); redo(); return }
      if (TOOL_SHORTCUTS[key]) { setActiveTool(TOOL_SHORTCUTS[key]); return }
      if (key === 'delete' || key === 'backspace') {
        const fc = getFabric()
        const obj = fc?.getActiveObject()
        if (obj && !obj.isEditing) { fc.remove(obj); fc.renderAll() }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setActiveTool, undo, redo])
}
