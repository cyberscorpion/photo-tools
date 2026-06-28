import React, { useRef, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import { initFabric, disposeFabric, setEventBridge, getFabric } from '../../canvas/fabricManager.js'
import { activateTool, deactivateTool } from '../../canvas/toolHandlers.js'

export default function CanvasStage() {
  const canvasRef = useRef(null)
  const prevToolRef = useRef(null)

  const imageSize = useEditorStore((s) => s.imageSize)
  const activeTool = useEditorStore((s) => s.activeTool)
  const toolOptions = useEditorStore((s) => s.toolOptions)
  const pushHistory = useEditorStore((s) => s.pushHistory)
  const setForegroundColor = useEditorStore((s) => s.setForegroundColor)

  const canvasW = imageSize.w || 800
  const canvasH = imageSize.h || 600

  // Init Fabric once on mount; clean up on unmount
  useEffect(() => {
    if (!canvasRef.current) return

    initFabric(canvasRef.current, canvasW, canvasH)

    return () => {
      deactivateTool(prevToolRef.current)
      disposeFabric()
      setEventBridge(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Resize Fabric canvas whenever image dimensions change
  useEffect(() => {
    const fc = getFabric()
    if (!fc) return
    fc.setDimensions({ width: canvasW, height: canvasH })
  }, [canvasW, canvasH])

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
    <canvas
      ref={canvasRef}
      style={{ display: 'block' }}
    />
  )
}
