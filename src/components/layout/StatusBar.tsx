import React from 'react'
import { useEditorStore } from '../../store/editorStore.js'

export default function StatusBar({ cursorX, cursorY }) {
  const zoom = useEditorStore((s) => s.zoom)
  const imageSize = useEditorStore((s) => s.imageSize)
  const fileName = useEditorStore((s) => s.fileName)

  const w = imageSize.w || 0
  const h = imageSize.h || 0
  const zoomPct = Math.round(zoom * 100)

  return (
    <div
      style={{
        height: 'var(--statusbar-h)',
        background: 'var(--bg-toolbar)',
        borderTop: '1px solid var(--border)',
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        fontSize: '11px',
        color: 'var(--text-dim)',
        gridArea: 'statusbar',
        userSelect: 'none',
      }}
    >
      {fileName && <span>{fileName}</span>}
      <span>Zoom: {zoomPct}%</span>
      {w > 0 && h > 0 && (
        <span>
          {w} &times; {h} px
        </span>
      )}
      {cursorX !== undefined && cursorY !== undefined && (
        <span>
          X: {cursorX} Y: {cursorY}
        </span>
      )}
    </div>
  )
}
