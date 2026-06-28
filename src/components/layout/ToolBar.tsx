import React from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import ToolButton from '../tools/ToolButton.jsx'
import toolConfig from '../tools/toolConfig.js'

// Tool groups — each inner array is one visual group separated by a divider
const TOOL_GROUPS = [
  ['select'],
  ['marquee-rect', 'marquee-ellipse'],
  ['lasso', 'lasso-poly'],
  ['magic-wand'],
  ['crop'],
  ['brush', 'eraser'],
  ['clone-stamp'],
  ['dodge', 'burn', 'blur-brush'],
  ['text'],
  ['pen'],
  ['rect', 'rounded-rect'],
  ['ellipse', 'polygon'],
  ['line'],
  ['paint-bucket', 'gradient'],
  ['eyedropper'],
  ['hand', 'zoom'],
]

const configById = Object.fromEntries(toolConfig.map((t) => [t.id, t]))

const DIVIDER = (
  <div
    style={{
      gridColumn: '1 / -1',
      height: '1px',
      background: 'var(--border)',
      margin: '2px 4px',
    }}
  />
)

export default function ToolBar() {
  const activeTool = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const foregroundColor = useEditorStore((s) => s.foregroundColor)
  const backgroundColor = useEditorStore((s) => s.backgroundColor)
  const setForegroundColor = useEditorStore((s) => s.setForegroundColor)
  const setBackgroundColor = useEditorStore((s) => s.setBackgroundColor)

  const fgInputRef = React.useRef<HTMLInputElement>(null)
  const bgInputRef = React.useRef<HTMLInputElement>(null)

  return (
    <div
      style={{
        width: '80px',
        background: 'var(--bg-toolbar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        paddingTop: '6px',
        paddingBottom: '6px',
        gridArea: 'toolbar',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Tool grid — 2 columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1px',
          padding: '0 4px',
        }}
      >
        {TOOL_GROUPS.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && DIVIDER}
            {group.map((id) => {
              const tool = configById[id]
              if (!tool) return null
              return (
                <ToolButton
                  key={id}
                  tool={tool}
                  isActive={activeTool === id}
                  onClick={() => setActiveTool(id as any)}
                />
              )
            })}
            {/* Pad odd-length groups so grid stays clean */}
            {group.length % 2 !== 0 && <div />}
          </React.Fragment>
        ))}
      </div>

      {/* Foreground / Background color swatches — always at bottom */}
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
        <div style={{ position: 'relative', width: '36px', height: '32px', flexShrink: 0 }}>
          {/* Background swatch */}
          <div
            title="Background Color"
            onClick={() => bgInputRef.current?.click()}
            style={{
              position: 'absolute', bottom: 0, right: 0,
              width: '20px', height: '20px',
              background: backgroundColor,
              border: '1px solid var(--border-light)',
              borderRadius: '2px', cursor: 'pointer',
            }}
          />
          {/* Foreground swatch */}
          <div
            title="Foreground Color"
            onClick={() => fgInputRef.current?.click()}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '20px', height: '20px',
              background: foregroundColor,
              border: '1px solid var(--border-light)',
              borderRadius: '2px', cursor: 'pointer', zIndex: 1,
            }}
          />
          <input ref={fgInputRef} type="color" value={foregroundColor}
            onChange={(e) => setForegroundColor(e.target.value)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            tabIndex={-1}
          />
          <input ref={bgInputRef} type="color" value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            tabIndex={-1}
          />
        </div>
      </div>
    </div>
  )
}
