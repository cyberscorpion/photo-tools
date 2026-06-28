import React, { useRef, useEffect, useCallback } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import CheckerBackground from '../canvas/CheckerBackground.jsx'
import CanvasStage from '../canvas/CanvasStage.jsx'
import { setWorkspaceContainer } from '../../canvas/viewportManager.js'

export default function WorkspaceArea({ onCursorMove }) {
  const imageSize = useEditorStore((s) => s.imageSize)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)

  const canvasW = imageSize.w || 800
  const canvasH = imageSize.h || 600

  const containerRef = useRef(null)

  // Register container for hand-tool pan
  useEffect(() => {
    setWorkspaceContainer(containerRef.current)
    return () => setWorkspaceContainer(null)
  }, [])

  // Native wheel listener — React onWheel is passive and cannot call preventDefault
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      e.stopPropagation()
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      // Read zoom directly — setZoom doesn't support functional updates (it's a plain setter)
      const cur = useEditorStore.getState().zoom
      const next = Math.max(0.05, Math.min(16, parseFloat((cur * factor).toFixed(3))))
      setZoom(next)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [setZoom])

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

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        overflow: 'auto',
        background: 'var(--bg-deep)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        gridArea: 'workspace',
      }}
    >
      {/* Phantom div sized to the zoomed canvas — gives the scrollbar its range */}
      <div
        style={{
          width: canvasW * zoom,
          height: canvasH * zoom,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* Actual canvas wrapper: CSS-scaled for visual zoom */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: canvasW,
            height: canvasH,
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <CheckerBackground width={canvasW} height={canvasH} />
          <CanvasStage />
        </div>
      </div>
    </div>
  )
}
