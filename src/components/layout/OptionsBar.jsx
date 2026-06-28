import React from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import { confirmCrop, cancelCrop } from '../../canvas/toolHandlers.js'
import { getFabric } from '../../canvas/fabricManager.js'

const barStyle = {
  height: 'var(--optionsbar-h)',
  background: 'var(--bg-toolbar)',
  borderBottom: '1px solid var(--border)',
  padding: '0 8px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  gridArea: 'optionsbar',
  overflow: 'hidden',
}

const labelStyle = {
  fontSize: '11px',
  color: 'var(--text-dim)',
  whiteSpace: 'nowrap',
}

const sliderWrapStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
}

const toggleBtnStyle = (active) => ({
  padding: '2px 8px',
  fontSize: '11px',
  borderRadius: '3px',
  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
  background: active ? 'var(--bg-active)' : 'transparent',
  color: active ? 'var(--text-bright)' : 'var(--text)',
  cursor: 'pointer',
})

export default function OptionsBar() {
  const activeTool = useEditorStore((s) => s.activeTool)
  const toolOptions = useEditorStore((s) => s.toolOptions)
  const setToolOption = useEditorStore((s) => s.setToolOption)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const selection = useEditorStore((s) => s.selection)
  const cropMode = useEditorStore((s) => s.cropMode)

  if (cropMode || activeTool === 'crop') {
    return (
      <div style={barStyle}>
        <span style={{ ...labelStyle, marginRight: 8 }}>Crop: Draw selection, then confirm</span>
        <button
          onClick={confirmCrop}
          style={{
            padding: '3px 14px', borderRadius: 3, fontSize: 11, fontWeight: 600,
            background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)', cursor: 'pointer',
          }}
        >
          ✓ Apply Crop
        </button>
        <button
          onClick={cancelCrop}
          style={{
            padding: '3px 14px', borderRadius: 3, fontSize: 11,
            background: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer',
          }}
        >
          ✕ Cancel
        </button>
      </div>
    )
  }

  if (activeTool === 'brush') {
    const opts = toolOptions.brush
    return (
      <div style={barStyle}>
        <div style={sliderWrapStyle}>
          <span style={labelStyle}>Size</span>
          <input
            type="range"
            min={1}
            max={100}
            value={opts.size}
            onChange={(e) => setToolOption('brush', 'size', Number(e.target.value))}
            style={{ width: '80px' }}
          />
          <span style={labelStyle}>{opts.size}</span>
        </div>
        <div style={sliderWrapStyle}>
          <span style={labelStyle}>Opacity</span>
          <input
            type="range"
            min={1}
            max={100}
            value={opts.opacity}
            onChange={(e) => setToolOption('brush', 'opacity', Number(e.target.value))}
            style={{ width: '80px' }}
          />
          <span style={labelStyle}>{opts.opacity}%</span>
        </div>
        <div style={sliderWrapStyle}>
          <span style={labelStyle}>Color</span>
          <input
            type="color"
            value={opts.color}
            onChange={(e) => setToolOption('brush', 'color', e.target.value)}
            style={{ width: '28px', height: '22px', padding: '1px', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', background: 'none' }}
          />
        </div>
      </div>
    )
  }

  if (activeTool === 'eraser') {
    const opts = toolOptions.eraser
    return (
      <div style={barStyle}>
        <div style={sliderWrapStyle}>
          <span style={labelStyle}>Size</span>
          <input
            type="range"
            min={1}
            max={100}
            value={opts.size}
            onChange={(e) => setToolOption('eraser', 'size', Number(e.target.value))}
            style={{ width: '80px' }}
          />
          <span style={labelStyle}>{opts.size}</span>
        </div>
      </div>
    )
  }

  if (activeTool === 'text') {
    const opts = toolOptions.text
    return (
      <div style={barStyle}>
        <div style={sliderWrapStyle}>
          <span style={labelStyle}>Font</span>
          <select
            value={opts.font}
            onChange={(e) => setToolOption('text', 'font', e.target.value)}
          >
            <option value="Arial">Arial</option>
            <option value="Georgia">Georgia</option>
            <option value="Courier New">Courier New</option>
            <option value="Impact">Impact</option>
          </select>
        </div>
        <div style={sliderWrapStyle}>
          <span style={labelStyle}>Size</span>
          <input
            type="number"
            min={6}
            max={200}
            value={opts.size}
            onChange={(e) => setToolOption('text', 'size', Number(e.target.value))}
            style={{ width: '48px' }}
          />
        </div>
        <button
          style={toggleBtnStyle(opts.bold)}
          onClick={() => setToolOption('text', 'bold', !opts.bold)}
        >
          <strong>B</strong>
        </button>
        <button
          style={toggleBtnStyle(opts.italic)}
          onClick={() => setToolOption('text', 'italic', !opts.italic)}
        >
          <em>I</em>
        </button>
        <div style={sliderWrapStyle}>
          <span style={labelStyle}>Color</span>
          <input
            type="color"
            value={opts.color}
            onChange={(e) => setToolOption('text', 'color', e.target.value)}
            style={{ width: '28px', height: '22px', padding: '1px', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', background: 'none' }}
          />
        </div>
      </div>
    )
  }

  if (activeTool === 'rect') {
    const opts = toolOptions.rect

    const updateActiveShape = (props) => {
      const fc = getFabric()
      if (!fc) return
      const obj = fc.getActiveObject()
      if (obj) { obj.set(props); fc.renderAll() }
    }

    return (
      <div style={barStyle}>
        <div style={sliderWrapStyle}>
          <span style={labelStyle}>Fill</span>
          <input
            type="color"
            value={opts.fill}
            onChange={(e) => {
              setToolOption('rect', 'fill', e.target.value)
              updateActiveShape({ fill: e.target.value })
            }}
            style={{ width: '28px', height: '22px', padding: '1px', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', background: 'none' }}
          />
        </div>
        <div style={sliderWrapStyle}>
          <span style={labelStyle}>Stroke</span>
          <input
            type="color"
            value={opts.stroke === 'transparent' ? '#000000' : opts.stroke}
            onChange={(e) => {
              setToolOption('rect', 'stroke', e.target.value)
              updateActiveShape({ stroke: e.target.value })
            }}
            style={{ width: '28px', height: '22px', padding: '1px', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', background: 'none' }}
          />
        </div>
        <div style={sliderWrapStyle}>
          <span style={labelStyle}>Width</span>
          <input
            type="number"
            min={0}
            max={20}
            value={opts.strokeWidth}
            onChange={(e) => {
              setToolOption('rect', 'strokeWidth', Number(e.target.value))
              updateActiveShape({ strokeWidth: Number(e.target.value) })
            }}
            style={{ width: '40px' }}
          />
        </div>
        <span style={{ ...labelStyle, marginLeft: 8, opacity: 0.6 }}>⇧ Shift = square</span>
      </div>
    )
  }

  if (activeTool === 'ellipse') {
    const opts = toolOptions.ellipse

    const updateActiveShape = (props) => {
      const fc = getFabric()
      if (!fc) return
      const obj = fc.getActiveObject()
      if (obj) { obj.set(props); fc.renderAll() }
    }

    return (
      <div style={barStyle}>
        <div style={sliderWrapStyle}>
          <span style={labelStyle}>Fill</span>
          <input
            type="color"
            value={opts.fill}
            onChange={(e) => {
              setToolOption('ellipse', 'fill', e.target.value)
              updateActiveShape({ fill: e.target.value })
            }}
            style={{ width: '28px', height: '22px', padding: '1px', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', background: 'none' }}
          />
        </div>
        <div style={sliderWrapStyle}>
          <span style={labelStyle}>Stroke</span>
          <input
            type="color"
            value={opts.stroke === 'transparent' ? '#000000' : opts.stroke}
            onChange={(e) => {
              setToolOption('ellipse', 'stroke', e.target.value)
              updateActiveShape({ stroke: e.target.value })
            }}
            style={{ width: '28px', height: '22px', padding: '1px', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', background: 'none' }}
          />
        </div>
        <div style={sliderWrapStyle}>
          <span style={labelStyle}>Width</span>
          <input
            type="number"
            min={0}
            max={20}
            value={opts.strokeWidth}
            onChange={(e) => {
              setToolOption('ellipse', 'strokeWidth', Number(e.target.value))
              updateActiveShape({ strokeWidth: Number(e.target.value) })
            }}
            style={{ width: '40px' }}
          />
        </div>
        <span style={{ ...labelStyle, marginLeft: 8, opacity: 0.6 }}>⇧ Shift = circle</span>
      </div>
    )
  }

  if (activeTool === 'zoom') {
    const zoomPct = Math.round(zoom * 100)
    return (
      <div style={barStyle}>
        <span style={labelStyle}>Zoom</span>
        <button
          style={{ padding: '2px 8px', border: '1px solid var(--border)', borderRadius: '3px', background: 'transparent' }}
          onClick={() => setZoom(Math.max(0.1, parseFloat((zoom - 0.25).toFixed(2))))}
        >
          -
        </button>
        <span style={{ ...labelStyle, minWidth: '40px', textAlign: 'center' }}>{zoomPct}%</span>
        <button
          style={{ padding: '2px 8px', border: '1px solid var(--border)', borderRadius: '3px', background: 'transparent' }}
          onClick={() => setZoom(Math.min(16, parseFloat((zoom + 0.25).toFixed(2))))}
        >
          +
        </button>
      </div>
    )
  }

  if (activeTool === 'select') {
    return (
      <div style={barStyle}>
        <span style={labelStyle}>
          {selection ? `Selected: ${selection}` : 'Nothing selected'}
        </span>
      </div>
    )
  }

  // Default: show tool name
  const toolNames = {
    crop: 'Crop',
    hand: 'Hand / Pan',
    eyedropper: 'Eyedropper',
    lasso: 'Lasso',
  }

  return (
    <div style={{ ...barStyle, justifyContent: 'space-between' }}>
      <span style={labelStyle}>{toolNames[activeTool] || ''}</span>
      <span style={{ ...labelStyle, marginRight: 4 }}>
        {Math.round(zoom * 100)}%
      </span>
    </div>
  )
}
