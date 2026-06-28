import React, { useRef, useEffect, useState } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import { initFabric, disposeFabric, setEventBridge, getFabric, setLayerIdGetter } from '../../canvas/fabricManager.js'
import { activateTool, deactivateTool } from '../../canvas/toolHandlers.js'
import ExportDialog from '../dialogs/ExportDialog.jsx'
import { applyAdjustments } from '../../canvas/adjustmentEngine.js'
import { syncLayers } from '../../canvas/layerBridge.js'

export default function CanvasStage() {
  const canvasRef = useRef(null)
  const prevToolRef = useRef(null)
  const [showExport, setShowExport] = useState(false)

  const imageSize = useEditorStore((s) => s.imageSize)
  const activeTool = useEditorStore((s) => s.activeTool)
  const toolOptions = useEditorStore((s) => s.toolOptions)
  const pushHistory = useEditorStore((s) => s.pushHistory)
  const setForegroundColor = useEditorStore((s) => s.setForegroundColor)
  const adjustments = useEditorStore((s) => s.adjustments)
  const activeFilters = useEditorStore((s) => s.activeFilters)
  const layers = useEditorStore((s) => s.layers)
  const activeLayerId = useEditorStore((s) => s.activeLayerId)

  const canvasW = imageSize.w || 800
  const canvasH = imageSize.h || 600

  // Init Fabric once on mount; clean up on unmount
  useEffect(() => {
    if (!canvasRef.current) return

    initFabric(canvasRef.current, canvasW, canvasH)
    // Wire the active-layer getter so fabricManager can auto-tag new objects
    setLayerIdGetter(() => useEditorStore.getState().activeLayerId)

    return () => {
      deactivateTool(prevToolRef.current)
      setLayerIdGetter(null as any)
      disposeFabric()
      setEventBridge(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Resize Fabric canvas whenever image dimensions change; skip on initial (0,0) state
  useEffect(() => {
    if (imageSize.w === 0 && imageSize.h === 0) return
    const fc = getFabric()
    if (!fc) return
    fc.setDimensions({ width: canvasW, height: canvasH })
  }, [canvasW, canvasH, imageSize.w, imageSize.h])

  // Listen for Ctrl+S export shortcut
  useEffect(() => {
    const handler = () => setShowExport(true)
    window.addEventListener('photo-tools:open-export', handler)
    return () => window.removeEventListener('photo-tools:open-export', handler)
  }, [])

  // Re-register the event bridge whenever pushHistory changes so the closure is always fresh
  useEffect(() => {
    const fc = getFabric()
    if (!fc) return

    setEventBridge((eventName) => {
      if (eventName === 'path:created' || eventName === 'object:modified') {
        const json = fc.toJSON()
        pushHistory(eventName, json)
      }
    })

    return () => {
      setEventBridge(null)
    }
  }, [pushHistory])

  // Apply non-destructive adjustments and filters whenever they change
  useEffect(() => {
    const fc = getFabric()
    if (!fc) return
    // Find the base image object (background layer or first FabricImage)
    const imgObj = fc.getObjects().find(
      (o) => o.layerId === 'background' ||
        (o.type === 'image' && o.layerId !== 'contour')
    )
    if (!imgObj) return
    applyAdjustments(imgObj, adjustments, activeFilters)
  }, [adjustments, activeFilters])

  // Sync layer visibility/opacity/blend mode to Fabric objects
  useEffect(() => {
    const fc = getFabric()
    if (!fc || layers.length === 0) return
    syncLayers(layers, activeLayerId)
  }, [layers, activeLayerId])

  // Activate tool when activeTool or toolOptions change
  useEffect(() => {
    if (prevToolRef.current && prevToolRef.current !== activeTool) {
      deactivateTool(prevToolRef.current)
    }
    prevToolRef.current = activeTool

    const storeActions = { setForegroundColor }
    activateTool(activeTool, toolOptions, storeActions)
  }, [activeTool, toolOptions, setForegroundColor])

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      {showExport && <ExportDialog isOpen={showExport} onClose={() => setShowExport(false)} />}
    </>
  )
}
