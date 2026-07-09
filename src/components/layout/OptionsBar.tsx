import React from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import { useLocalFonts } from '../../hooks/useLocalFonts.ts'
import { confirmCrop, cancelCrop } from '../../canvas/toolHandlers.js'
import { getFabric } from '../../canvas/fabricManager.js'
import { reloadCanvasAsImage, applyMaskFill, applyMaskErase, hexToRgbArr, getLowerCtx } from '../../utils/canvasOps.js'

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

const actionBtnStyle = {
  padding: '3px 10px',
  fontSize: '11px',
  borderRadius: '3px',
  border: '1px solid var(--border)',
  background: 'var(--bg-hover)',
  color: 'var(--text)',
  cursor: 'pointer',
}

export default function OptionsBar() {
  const activeTool = useEditorStore((s) => s.activeTool)
  const toolOptions = useEditorStore((s) => s.toolOptions)
  const setToolOption = useEditorStore((s) => s.setToolOption)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const selection = useEditorStore((s) => s.selection)
  const cropMode = useEditorStore((s) => s.cropMode)
  const activeSelection = useEditorStore((s) => s.activeSelection)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const foregroundColor = useEditorStore((s) => s.foregroundColor)
  const { fonts: availableFonts } = useLocalFonts()

  const fillFG = async () => {
    const ctx = getLowerCtx()
    if (!ctx || !activeSelection) return
    const fc = getFabric() as any
    const canvasW = fc?.width ?? 0, canvasH = fc?.height ?? 0
    const activeMask = activeSelection.featheredMask ?? activeSelection.mask
    if (activeMask && canvasW && canvasH) {
      const [r, g, b] = hexToRgbArr(foregroundColor)
      applyMaskFill(ctx, activeMask, canvasW, canvasH, r, g, b, 255)
    } else {
      const { x, y, w, h } = activeSelection.bounds
      const [r, g, b] = hexToRgbArr(foregroundColor)
      ctx.save()
      ctx.fillStyle = `rgba(${r},${g},${b},1)`
      ctx.fillRect(x, y, w, h)
      ctx.restore()
    }
    await reloadCanvasAsImage()
    const fc2 = getFabric() as any
    if (fc2) useEditorStore.getState().pushHistory('Fill FG', fc2.toJSON(['customId','layerId']))
  }

  const fillBG = async () => {
    const ctx = getLowerCtx()
    if (!ctx || !activeSelection) return
    const fc = getFabric() as any
    const canvasW = fc?.width ?? 0, canvasH = fc?.height ?? 0
    const bgColor = useEditorStore.getState().backgroundColor ?? '#ffffff'
    const activeMask = activeSelection.featheredMask ?? activeSelection.mask
    if (activeMask && canvasW && canvasH) {
      const [r, g, b] = hexToRgbArr(bgColor)
      applyMaskFill(ctx, activeMask, canvasW, canvasH, r, g, b, 255)
    } else {
      const { x, y, w, h } = activeSelection.bounds
      const [r, g, b] = hexToRgbArr(bgColor)
      ctx.save()
      ctx.fillStyle = `rgba(${r},${g},${b},1)`
      ctx.fillRect(x, y, w, h)
      ctx.restore()
    }
    await reloadCanvasAsImage()
    const fc2 = getFabric() as any
    if (fc2) useEditorStore.getState().pushHistory('Fill BG', fc2.toJSON(['customId','layerId']))
  }

  const deleteSelection = async () => {
    const ctx = getLowerCtx()
    if (!ctx || !activeSelection) return
    const fc = getFabric() as any
    const canvasW = fc?.width ?? 0, canvasH = fc?.height ?? 0
    const activeMask = activeSelection.featheredMask ?? activeSelection.mask
    if (activeMask && canvasW && canvasH) {
      applyMaskErase(ctx, activeMask, canvasW, canvasH)
    } else {
      const { x, y, w, h } = activeSelection.bounds
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.fillRect(x, y, w, h)
      ctx.restore()
    }
    await reloadCanvasAsImage()
    const fc2 = getFabric() as any
    if (fc2) useEditorStore.getState().pushHistory('Delete Selection', fc2.toJSON(['customId','layerId']))
  }

  // Selection action bar — shown for non-wand tools when there is an active selection
  if (activeSelection && activeTool !== 'magic-wand') {
    return (
      <div style={{ ...barStyle, gap: 8 }}>
        <span style={labelStyle}>Selection active</span>
        <button onClick={fillFG} style={actionBtnStyle}>Fill FG</button>
        <button onClick={fillBG} style={actionBtnStyle}>Fill BG</button>
        <button onClick={deleteSelection} style={{ ...actionBtnStyle, color: '#e74c3c' }}>Delete</button>
        <button onClick={clearSelection} style={actionBtnStyle}>Deselect</button>
      </div>
    )
  }

  // Crop mode active (rect drawn) — show Apply / Cancel
  if (cropMode) {
    return (
      <div style={barStyle}>
        <span style={{ ...labelStyle, marginRight: 8 }}>Drag handles to adjust • Enter to apply • Esc to cancel</span>
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

  // Crop tool selected but handles not yet created (brief moment before activateCrop fires)
  if (activeTool === 'crop') {
    return (
      <div style={barStyle}>
        <span style={labelStyle}>Crop — drag handles to adjust, or drag to draw a new crop area</span>
      </div>
    )
  }

  if (activeTool === 'marquee-rect') {
    return (
      <div style={barStyle}>
        <span style={labelStyle}>Drag to select • Shift = constrain</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Shift: add • Alt: subtract</span>
      </div>
    )
  }

  if (activeTool === 'marquee-ellipse') {
    return (
      <div style={barStyle}>
        <span style={labelStyle}>Drag to select • Shift = constrain</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Shift: add • Alt: subtract</span>
      </div>
    )
  }

  if (activeTool === 'magic-wand') {
    const opts = toolOptions['magic-wand'] ?? { tolerance: 32, contiguous: true, feather: 0 }
    return (
      <div style={barStyle}>
        <span style={labelStyle}>Tolerance</span>
        <input type="range" min={0} max={255} value={opts.tolerance}
          onChange={e => setToolOption('magic-wand', 'tolerance', +e.target.value)} style={{ width: 80 }} />
        <span style={labelStyle}>{opts.tolerance}</span>
        <span style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />
        <button
          style={toggleBtnStyle(opts.contiguous ?? true)}
          onClick={() => setToolOption('magic-wand', 'contiguous', !(opts.contiguous ?? true))}
        >
          Contiguous
        </button>
        <span style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />
        <span style={labelStyle}>Feather</span>
        <input type="range" min={0} max={50} value={opts.feather ?? 0}
          onChange={e => setToolOption('magic-wand', 'feather', +e.target.value)} style={{ width: 70 }} />
        <span style={labelStyle}>{opts.feather ?? 0}px</span>
        {activeSelection && (
          <>
            <span style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />
            <button onClick={fillFG} style={actionBtnStyle}>Fill FG</button>
            <button onClick={fillBG} style={actionBtnStyle}>Fill BG</button>
            <button onClick={deleteSelection} style={{ ...actionBtnStyle, color: '#e74c3c' }}>Delete</button>
            <button onClick={clearSelection} style={actionBtnStyle}>Deselect</button>
          </>
        )}
        {!activeSelection && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Click to select • Delete to erase • Fill FG/BG to fill</span>
        )}
      </div>
    )
  }

  if (activeTool === 'lasso-poly') {
    return <div style={barStyle}><span style={labelStyle}>Click to add points • Click first point to close • Double-click to finish</span></div>
  }

  if (activeTool === 'line') {
    const opts = toolOptions.line ?? { stroke: '#000000', strokeWidth: 2 }
    return (
      <div style={barStyle}>
        <span style={labelStyle}>Color</span>
        <input type="color" value={opts.stroke} onChange={e => setToolOption('line', 'stroke', e.target.value)} style={{ width: 28, height: 22, padding: 1, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', background: 'none' }} />
        <span style={labelStyle}>Width</span>
        <input type="number" min={1} max={50} value={opts.strokeWidth} onChange={e => setToolOption('line', 'strokeWidth', +e.target.value)} style={{ width: 48 }} />
        <span style={labelStyle}>⇧ Shift = 45° snap</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Shift: 45° snap</span>
      </div>
    )
  }

  if (activeTool === 'rounded-rect') {
    const opts = toolOptions['rounded-rect'] ?? { fill: '#ff0000', stroke: 'transparent', strokeWidth: 0, radius: 10 }
    return (
      <div style={barStyle}>
        <span style={labelStyle}>Fill</span>
        <input type="color" value={opts.fill} onChange={e => setToolOption('rounded-rect', 'fill', e.target.value)} style={{ width: 28, height: 22, padding: 1, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', background: 'none' }} />
        <span style={labelStyle}>Radius</span>
        <input type="range" min={0} max={100} value={opts.radius} onChange={e => setToolOption('rounded-rect', 'radius', +e.target.value)} style={{ width: 80 }} />
        <span style={labelStyle}>{opts.radius}px</span>
        <span style={{ ...labelStyle, opacity: 0.6 }}>⇧ Shift = square</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Shift: square • Alt: from center</span>
      </div>
    )
  }

  if (activeTool === 'polygon') {
    const opts = toolOptions.polygon ?? { fill: '#ff0000', stroke: 'transparent', strokeWidth: 0, sides: 6 }
    return (
      <div style={barStyle}>
        <span style={labelStyle}>Fill</span>
        <input type="color" value={opts.fill} onChange={e => setToolOption('polygon', 'fill', e.target.value)} style={{ width: 28, height: 22, padding: 1, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', background: 'none' }} />
        <span style={labelStyle}>Sides</span>
        <input type="range" min={3} max={12} value={opts.sides} onChange={e => setToolOption('polygon', 'sides', +e.target.value)} style={{ width: 80 }} />
        <span style={labelStyle}>{opts.sides}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Shift: snap angle</span>
      </div>
    )
  }

  if (activeTool === 'paint-bucket') {
    const opts = toolOptions['paint-bucket'] ?? { tolerance: 32, contiguous: true }
    return (
      <div style={barStyle}>
        <span style={labelStyle}>Tolerance</span>
        <input type="range" min={0} max={255} value={opts.tolerance} onChange={e => setToolOption('paint-bucket', 'tolerance', +e.target.value)} style={{ width: 80 }} />
        <span style={labelStyle}>{opts.tolerance}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer' }}>
          <input type="checkbox" checked={opts.contiguous} onChange={e => setToolOption('paint-bucket', 'contiguous', e.target.checked)} />
          Contiguous
        </label>
      </div>
    )
  }

  if (activeTool === 'gradient') {
    const opts = toolOptions.gradient ?? { type: 'linear', opacity: 100 }
    return (
      <div style={barStyle}>
        <span style={labelStyle}>Type</span>
        <select value={opts.type} onChange={e => setToolOption('gradient', 'type', e.target.value)}>
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
        </select>
        <span style={labelStyle}>Opacity</span>
        <input type="range" min={1} max={100} value={opts.opacity} onChange={e => setToolOption('gradient', 'opacity', +e.target.value)} style={{ width: 80 }} />
        <span style={labelStyle}>{opts.opacity}%</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Shift: constrain angle</span>
      </div>
    )
  }

  if (activeTool === 'clone-stamp') {
    const opts = toolOptions['clone-stamp'] ?? { size: 30, opacity: 100 }
    return (
      <div style={barStyle}>
        <span style={labelStyle}>Size</span>
        <input type="range" min={1} max={200} value={opts.size} onChange={e => setToolOption('clone-stamp', 'size', +e.target.value)} style={{ width: 80 }} />
        <span style={labelStyle}>{opts.size}</span>
        <span style={labelStyle}>Opacity</span>
        <input type="range" min={1} max={100} value={opts.opacity} onChange={e => setToolOption('clone-stamp', 'opacity', +e.target.value)} style={{ width: 80 }} />
        <span style={labelStyle}>{opts.opacity}%</span>
        <span style={{ ...labelStyle, opacity: 0.6 }}>Alt+click to set sample</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Alt+click: set sample point</span>
      </div>
    )
  }

  if (activeTool === 'dodge' || activeTool === 'burn') {
    const opts = toolOptions[activeTool] ?? { size: 30, exposure: 50 }
    return (
      <div style={barStyle}>
        <span style={labelStyle}>Size</span>
        <input type="range" min={1} max={200} value={opts.size} onChange={e => setToolOption(activeTool, 'size', +e.target.value)} style={{ width: 80 }} />
        <span style={labelStyle}>{opts.size}</span>
        <span style={labelStyle}>Exposure</span>
        <input type="range" min={1} max={100} value={opts.exposure} onChange={e => setToolOption(activeTool, 'exposure', +e.target.value)} style={{ width: 80 }} />
        <span style={labelStyle}>{opts.exposure}%</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>
          {activeTool === 'dodge' ? 'Alt/Shift: switch to Burn' : 'Alt/Shift: switch to Dodge'}
        </span>
      </div>
    )
  }

  if (activeTool === 'blur-brush') {
    const opts = toolOptions['blur-brush'] ?? { size: 30, strength: 50 }
    return (
      <div style={barStyle}>
        <span style={labelStyle}>Size</span>
        <input type="range" min={1} max={200} value={opts.size} onChange={e => setToolOption('blur-brush', 'size', +e.target.value)} style={{ width: 80 }} />
        <span style={labelStyle}>{opts.size}</span>
        <span style={labelStyle}>Strength</span>
        <input type="range" min={1} max={100} value={opts.strength} onChange={e => setToolOption('blur-brush', 'strength', +e.target.value)} style={{ width: 80 }} />
        <span style={labelStyle}>{opts.strength}%</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Alt/Shift: Sharpen mode</span>
      </div>
    )
  }

  if (activeTool === 'pen') {
    const opts = toolOptions.pen ?? { stroke: '#000000', strokeWidth: 2, fill: 'transparent' }
    return (
      <div style={barStyle}>
        <span style={labelStyle}>Stroke</span>
        <input type="color" value={opts.stroke} onChange={e => setToolOption('pen', 'stroke', e.target.value)} style={{ width: 28, height: 22, padding: 1, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', background: 'none' }} />
        <span style={labelStyle}>Width</span>
        <input type="number" min={1} max={20} value={opts.strokeWidth} onChange={e => setToolOption('pen', 'strokeWidth', +e.target.value)} style={{ width: 48 }} />
        <span style={{ ...labelStyle, opacity: 0.6 }}>Click=point • Click first point to close • Enter=finish • Esc=cancel</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Shift: snap 45° • Enter: finish • Esc: cancel</span>
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
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Alt: sample color • Shift+click: straight line</span>
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
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Shift+click: straight line</span>
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
            style={{ maxWidth: 140, fontSize: 11 }}
          >
            {availableFonts.map((family) => (
              <option key={family} value={family} style={{ fontFamily: family }}>
                {family}
              </option>
            ))}
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
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Shift: square • Alt: from center • Shift+Alt: square from center</span>
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
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Shift: circle • Alt: from center • Shift+Alt: circle from center</span>
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
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0, paddingRight: 4, whiteSpace: 'nowrap' }}>Shift/Alt: zoom out</span>
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
