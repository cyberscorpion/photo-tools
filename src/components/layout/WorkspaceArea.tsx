import React, { useRef, useEffect, useCallback } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import CheckerBackground from '../canvas/CheckerBackground.jsx'
import CanvasStage from '../canvas/CanvasStage.jsx'
import { setWorkspaceContainer } from '../../canvas/viewportManager.js'
import { CANVAS_PAD } from '../../canvas/fabricManager.js'

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
        background: 'var(--bg-workspace)',
        gridArea: 'workspace',
        height: '100%',
        // display:flex so the inner div can use margin:auto for centering.
        // NEVER use justify-content/align-items:center here — when the canvas
        // is larger than the viewport that positions the item at a negative
        // offset (cut off left/top permanently). margin:auto on the ITEM
        // collapses to 0 when there is no surplus space, keeping the item
        // at origin so every pixel is reachable by scrolling.
        display: 'flex',
      }}
    >
      {/* margin:auto centers when smaller than viewport; 0 when larger → fully scrollable */}
      <div
        style={{
          margin: 'auto',
          padding: 80,
          flexShrink: 0,
        }}
      >
        {/* Phantom div: gives the scrollbar its range = zoomed canvas size */}
        <div
          style={{
            width: canvasW * zoom,
            height: canvasH * zoom,
            position: 'relative',
          }}
        >
          {/* Checker sits in screen-pixel space so its tile size never changes with zoom */}
          <CheckerBackground width={canvasW * zoom} height={canvasH * zoom} />
        {/* Canvas wrapper: CSS-scaled for visual zoom.
             top/left are offset by -CANVAS_PAD*zoom so the image (placed at
             Fabric (PAD,PAD)) visually aligns with the phantom-div origin.
             overflow:visible lets the Fabric canvas (PAD pixels larger on each
             side) render handles outside the image boundary without clipping. */}
          <div
            style={{
              position: 'absolute',
              top: -CANVAS_PAD * zoom,
              left: -CANVAS_PAD * zoom,
              width: canvasW,
              height: canvasH,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
              overflow: 'visible',
            }}
          >
            <CanvasStage />
          </div>
        </div>
      </div>
    </div>
  )
}
