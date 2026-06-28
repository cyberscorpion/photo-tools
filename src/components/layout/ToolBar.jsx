import React, { useState } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import ToolButton from '../tools/ToolButton.jsx'
import toolConfig from '../tools/toolConfig.js'

export default function ToolBar() {
  const activeTool = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const foregroundColor = useEditorStore((s) => s.foregroundColor)
  const backgroundColor = useEditorStore((s) => s.backgroundColor)
  const setForegroundColor = useEditorStore((s) => s.setForegroundColor)
  const setBackgroundColor = useEditorStore((s) => s.setBackgroundColor)

  const fgInputRef = React.useRef(null)
  const bgInputRef = React.useRef(null)

  return (
    <div
      style={{
        width: 'var(--toolbar-w)',
        background: 'var(--bg-toolbar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '8px',
        gap: '2px',
        gridArea: 'toolbar',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {toolConfig.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          isActive={activeTool === tool.id}
          onClick={() => setActiveTool(tool.id)}
        />
      ))}

      {/* Foreground / Background color swatches */}
      <div
        style={{
          position: 'relative',
          width: '32px',
          height: '32px',
          marginTop: 'auto',
          marginBottom: '8px',
          flexShrink: 0,
        }}
      >
        {/* Background swatch (behind) */}
        <div
          title="Background Color"
          onClick={() => bgInputRef.current && bgInputRef.current.click()}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '20px',
            height: '20px',
            background: backgroundColor,
            border: '1px solid var(--border-light)',
            borderRadius: '2px',
            cursor: 'pointer',
          }}
        />
        {/* Foreground swatch (in front) */}
        <div
          title="Foreground Color"
          onClick={() => fgInputRef.current && fgInputRef.current.click()}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '20px',
            height: '20px',
            background: foregroundColor,
            border: '1px solid var(--border-light)',
            borderRadius: '2px',
            cursor: 'pointer',
            zIndex: 1,
          }}
        />
        {/* Hidden color inputs */}
        <input
          ref={fgInputRef}
          type="color"
          value={foregroundColor}
          onChange={(e) => setForegroundColor(e.target.value)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          tabIndex={-1}
        />
        <input
          ref={bgInputRef}
          type="color"
          value={backgroundColor}
          onChange={(e) => setBackgroundColor(e.target.value)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          tabIndex={-1}
        />
      </div>
    </div>
  )
}
