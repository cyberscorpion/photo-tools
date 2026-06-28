import { useCallback } from 'react'
import { useEditorStore } from '../store/editorStore.js'
import { getFabric } from '../canvas/fabricManager.js'

export function useZoom() {
  const { zoom, setZoom } = useEditorStore()

  const handleWheel = useCallback((e) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    const fc = getFabric()
    if (!fc) return
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const newZoom = Math.min(20, Math.max(0.1, zoom + delta))
    fc.zoomToPoint({ x: e.offsetX, y: e.offsetY }, newZoom)
    setZoom(newZoom)
  }, [zoom, setZoom])

  const zoomIn = () => {
    const fc = getFabric(); if (!fc) return
    const nz = Math.min(20, zoom + 0.25)
    fc.setZoom(nz); setZoom(nz)
  }
  const zoomOut = () => {
    const fc = getFabric(); if (!fc) return
    const nz = Math.max(0.1, zoom - 0.25)
    fc.setZoom(nz); setZoom(nz)
  }
  const fitToScreen = (containerW, containerH) => {
    const store = useEditorStore.getState()
    const nz = Math.min(containerW / store.imageSize.w, containerH / store.imageSize.h, 1)
    const fc = getFabric(); if (!fc) return
    fc.setZoom(nz); setZoom(nz)
  }

  return { zoom, handleWheel, zoomIn, zoomOut, fitToScreen }
}
