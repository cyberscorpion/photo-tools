import React, { useRef, useCallback } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import CheckerBackground from '../canvas/CheckerBackground.jsx'
import CanvasStage from '../canvas/CanvasStage.jsx'

export default function WorkspaceArea({ onCursorMove }) {
  const imageSize = useEditorStore((s) => s.imageSize)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)

  const canvasW = imageSize.w || 800
  const canvasH = imageSize.h || 600

  const containerRef = useRef(null)

  const handleMouseMove = useCallback(
    (e) => {
      if (!onCursorMove) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = Math.round((e.clientX - rect.left) / zoom)
      const y = Math.round((e.clientY - rect.top) / zoom)
      onCursorMove(x, y)
    },
    [onCursorMove, zoom]
  )

  const handleWheel = useCallback(
    (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      const next = Math.max(0.1, Math.min(10, zoom + delta))
      setZoom(parseFloat(next.toFixed(2)))
    },
    [zoom, setZoom]
  )

  return (
    <div
      ref={containerRef}
      style={{
        overflow: 'auto',
        background: 'var(--bg-deep)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        gridArea: 'workspace',
      }}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
    >
      <div
        style={{
          position: 'relative',
          width: canvasW,
          height: canvasH,
          flexShrink: 0,
        }}
      >
        <CheckerBackground width={canvasW} height={canvasH} />
        <CanvasStage />
      </div>
    </div>
  )
}
