import React, { useState, useCallback, useRef } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import {
  renderContour,
  removeContourFromCanvas,
  exportContourAsPNG,
  exportContourAsJPEG,
  exportContourAsSVG,
} from '../../canvas/contourEngine.js'
import PanelContainer from './PanelContainer.jsx'

// ─── STYLES ──────────────────────────────────────────────────────────────────
const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 10px',
}

const labelStyle = {
  fontSize: 11,
  color: 'var(--text-dim)',
  width: 72,
  flexShrink: 0,
}

const valueStyle = {
  fontSize: 11,
  color: 'var(--text)',
  width: 28,
  textAlign: 'right',
  flexShrink: 0,
}

const sliderStyle = { flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }

const numInputStyle = {
  width: 42,
  background: 'var(--bg-deep)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  padding: '2px 4px',
  borderRadius: 2,
  fontSize: 11,
  flexShrink: 0,
}

const sectionLabelStyle = {
  padding: '8px 10px 3px',
  fontSize: 10,
  color: 'var(--text-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  fontWeight: 600,
  borderTop: '1px solid var(--border)',
  marginTop: 2,
}

function ToggleBtn({ active = false, danger = false, disabled = false, onClick, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '5px 0',
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        background: active ? 'var(--accent)' : danger ? 'rgba(231,76,60,0.15)' : 'var(--bg-hover)',
        color: active ? '#fff' : danger ? '#e74c3c' : 'var(--text)',
        border: active
          ? '1px solid var(--accent)'
          : danger
          ? '1px solid rgba(231,76,60,0.4)'
          : '1px solid var(--border)',
      }}
    >
      {children}
    </button>
  )
}

function SliderRow({ label, value, min, max, step = 1, unit = '', onChange }) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={sliderStyle}
      />
      <span style={valueStyle}>{value}{unit}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Math.min(max, Math.max(min, Number(e.target.value) || min))
          onChange(v)
        }}
        style={numInputStyle}
      />
    </div>
  )
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function ContourPanel() {
  const { panels, togglePanel, hasImage, fileName } = useEditorStore()

  const [offset,     setOffset]     = useState(0)
  const [thickness,  setThickness]  = useState(10)
  const [color,      setColor]      = useState('#ff0000')
  const [opacity,    setOpacity]    = useState(100)
  const [smoothness, setSmoothness] = useState(0)
  const [enabled,    setEnabled]    = useState(false)
  const [loading,    setLoading]    = useState(false)

  const debounceRef = useRef(null)

  const applyContour = useCallback(async (off, thick, col, opa, smooth, on) => {
    if (!on) { removeContourFromCanvas(); return }
    setLoading(true)
    try {
      await renderContour(off, thick, col, opa / 100, smooth)
    } finally {
      setLoading(false)
    }
  }, [])

  const schedule = useCallback((off, thick, col, opa, smooth, on) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => applyContour(off, thick, col, opa, smooth, on), 80)
  }, [applyContour])

  // Helpers that update state and immediately schedule a re-render
  const handle = (setter) => (val) => {
    setter(val)
    // Read other state values fresh so we don't close over stale copies
  }

  const handleOffset = (v) => {
    setOffset(v)
    if (enabled) schedule(v, thickness, color, opacity, smoothness, true)
  }
  const handleThickness = (v) => {
    setThickness(v)
    if (enabled) schedule(offset, v, color, opacity, smoothness, true)
  }
  const handleColor = (v) => {
    setColor(v)
    if (enabled) schedule(offset, thickness, v, opacity, smoothness, true)
  }
  const handleOpacity = (v) => {
    setOpacity(v)
    if (enabled) schedule(offset, thickness, color, v, smoothness, true)
  }
  const handleSmoothness = (v) => {
    setSmoothness(v)
    if (enabled) schedule(offset, thickness, color, opacity, v, true)
  }

  const handleToggle = () => {
    const next = !enabled
    setEnabled(next)
    applyContour(offset, thickness, color, opacity, smoothness, next)
  }

  const handleRemove = () => {
    setEnabled(false)
    removeContourFromCanvas()
  }

  const handleExportPNG = () =>
    exportContourAsPNG(offset, thickness, color, smoothness, fileName || 'photo-tools')
  const handleExportJPEG = () =>
    exportContourAsJPEG(offset, thickness, color, smoothness, fileName || 'photo-tools')
  const handleExportSVG = () =>
    exportContourAsSVG(offset, thickness, color, smoothness, fileName || 'photo-tools')

  const isOpen = panels.contour ?? true

  return (
    <PanelContainer title="Contour" isOpen={isOpen} onToggle={() => togglePanel('contour')}>

      {/* Enable / Disable */}
      <div style={{ padding: '8px 10px 6px' }}>
        <ToggleBtn active={enabled} disabled={!hasImage} onClick={handleToggle}>
          {loading ? 'Generating…' : enabled ? '● Contour Active' : '○ Enable Contour'}
        </ToggleBtn>
      </div>

      {/* ── Geometry ── */}
      <div style={sectionLabelStyle}>Geometry</div>

      <SliderRow
        label="Offset (px)"
        value={offset}
        min={0}
        max={100}
        onChange={handleOffset}
      />
      <div style={{ padding: '1px 10px 3px 82px' }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          Gap between image edge and contour
        </span>
      </div>

      <SliderRow
        label="Thickness (px)"
        value={thickness}
        min={1}
        max={100}
        onChange={handleThickness}
      />
      <div style={{ padding: '1px 10px 4px 82px' }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          Width of the contour band
        </span>
      </div>

      <SliderRow
        label="Corner Radius"
        value={smoothness}
        min={0}
        max={100}
        onChange={handleSmoothness}
      />
      <div style={{ padding: '1px 10px 4px 82px' }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          Round path corners — straight edges stay sharp
        </span>
      </div>

      {/* ── Appearance ── */}
      <div style={sectionLabelStyle}>Appearance</div>

      {/* Color */}
      <div style={rowStyle}>
        <span style={labelStyle}>Color</span>
        <input
          type="color"
          value={color}
          onChange={(e) => handleColor(e.target.value)}
          style={{ width: 30, height: 22, border: 'none', padding: 0, cursor: 'pointer', background: 'none', flexShrink: 0 }}
        />
        <input
          type="text"
          value={color}
          onChange={(e) => {
            const v = e.target.value
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
              setColor(v)
              if (enabled && v.length === 7) schedule(offset, thickness, v, opacity, smoothness, true)
            }
          }}
          style={{ ...numInputStyle, flex: 1, width: 'auto' }}
        />
      </div>

      <SliderRow
        label="Opacity"
        value={opacity}
        min={1}
        max={100}
        unit="%"
        onChange={handleOpacity}
      />

      {/* Remove */}
      {enabled && (
        <div style={{ padding: '6px 10px 2px' }}>
          <ToggleBtn danger onClick={handleRemove}>Remove Contour</ToggleBtn>
        </div>
      )}

      {/* ── Export ── */}
      <div style={sectionLabelStyle}>Export Contour Path</div>
      <div style={{ display: 'flex', gap: 6, padding: '6px 10px 10px' }}>
        <button
          onClick={handleExportPNG}
          disabled={!hasImage}
          title="Transparent PNG — contour pixels only"
          style={{
            flex: 1, padding: '5px 0', borderRadius: 3, fontSize: 11,
            cursor: hasImage ? 'pointer' : 'not-allowed', opacity: hasImage ? 1 : 0.4,
            background: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)',
          }}
        >
          Export PNG
        </button>
        <button
          onClick={handleExportJPEG}
          disabled={!hasImage}
          title="JPEG export (white background)"
          style={{
            flex: 1, padding: '5px 0', borderRadius: 3, fontSize: 11,
            cursor: hasImage ? 'pointer' : 'not-allowed', opacity: hasImage ? 1 : 0.4,
            background: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)',
          }}
        >
          Export JPG
        </button>
        <button
          onClick={handleExportSVG}
          disabled={!hasImage}
          title="SVG file with contour &lt;path&gt; element"
          style={{
            flex: 1, padding: '5px 0', borderRadius: 3, fontSize: 11,
            cursor: hasImage ? 'pointer' : 'not-allowed', opacity: hasImage ? 1 : 0.4,
            background: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)',
          }}
        >
          Export SVG
        </button>
      </div>

    </PanelContainer>
  )
}
