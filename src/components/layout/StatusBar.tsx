import React from 'react'
import { useEditorStore } from '../../store/editorStore.js'

export default function StatusBar({ cursorX, cursorY }) {
  const zoom = useEditorStore((s) => s.zoom)
  const imageSize = useEditorStore((s) => s.imageSize)
  const fileName = useEditorStore((s) => s.fileName)
  const cropPreviewSize = useEditorStore((s: any) => s.cropPreviewSize as { w: number; h: number } | null)

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
      {cropPreviewSize ? (
        <span style={{ color: 'var(--accent, #0078d4)', fontWeight: 500 }}>
          ✂ {cropPreviewSize.w} &times; {cropPreviewSize.h} px
        </span>
      ) : w > 0 && h > 0 ? (
        <span>{w} &times; {h} px</span>
      ) : null}
      {cursorX !== undefined && cursorY !== undefined && (
        <span>
          X: {cursorX} Y: {cursorY}
        </span>
      )}

      {/* Credits — pushed to the far right */}
      <a
        href="https://www.linkedin.com/in/rajatjain-cs/"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: 'var(--text-bright)',
          textDecoration: 'none',
          opacity: 0.85,
          transition: 'opacity 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
        title="Rajat Jain — LinkedIn"
      >
        Made by Rajat Jain
      </a>
    </div>
  )
}
