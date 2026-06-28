// CSS transform in WorkspaceArea is the single source of truth for visual zoom.
// Fabric's viewportTransform MUST stay at identity — calling fc.setZoom() or
// fc.zoomToPoint() corrupts getViewportPoint() coordinate calculations for all
// tools (divides every pointer position by the internal zoom factor).
import { useCallback } from 'react'
import { useEditorStore } from '../store/editorStore.js'

export function useZoom() {
  const { zoom, setZoom } = useEditorStore()

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const newZoom = Math.min(16, Math.max(0.05, parseFloat((zoom + delta).toFixed(3))))
    setZoom(newZoom)
  }, [zoom, setZoom])

  const zoomIn       = () => setZoom(Math.min(16, parseFloat((zoom * 1.25).toFixed(3))))
  const zoomOut      = () => setZoom(Math.max(0.05, parseFloat((zoom / 1.25).toFixed(3))))
  const fitToScreen  = () => setZoom(1)

  return { zoom, handleWheel, zoomIn, zoomOut, fitToScreen }
}
