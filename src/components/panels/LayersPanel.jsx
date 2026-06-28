import React, { useState, useRef } from 'react'
import { Eye, EyeOff, Plus, Trash2, Copy } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore.js'
import PanelContainer from './PanelContainer.jsx'

const BLEND_MODES = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'soft-light',
  'hard-light',
  'difference',
]

const css = {
  container: {
    background: 'var(--bg-panel)',
    padding: '0',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: '4px 0',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  row: (isActive) => ({
    display: 'flex',
    flexDirection: 'column',
    padding: '4px 8px',
    cursor: 'pointer',
    border: isActive ? '1px solid var(--accent, #4dabf7)' : '1px solid transparent',
    borderRadius: '3px',
    margin: '2px 4px',
    background: isActive ? 'rgba(77,171,247,0.08)' : 'transparent',
    transition: 'border-color 0.1s, background 0.1s',
    userSelect: 'none',
  }),
  rowTop: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '6px',
    minHeight: '34px',
  },
  eyeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
    color: 'var(--text-secondary, #aaa)',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  thumbnail: {
    width: '40px',
    height: '30px',
    objectFit: 'cover',
    borderRadius: '2px',
    background: '#555',
    flexShrink: 0,
    border: '1px solid var(--border-light, #333)',
  },
  thumbnailPlaceholder: {
    width: '40px',
    height: '30px',
    background: '#555',
    borderRadius: '2px',
    flexShrink: 0,
    border: '1px solid var(--border-light, #333)',
  },
  layerName: {
    flex: 1,
    fontSize: '12px',
    color: 'var(--text-primary, #ddd)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  nameInput: {
    flex: 1,
    fontSize: '12px',
    background: 'var(--bg-input, #222)',
    color: 'var(--text-primary, #ddd)',
    border: '1px solid var(--accent, #4dabf7)',
    borderRadius: '2px',
    padding: '1px 4px',
    outline: 'none',
  },
  rowBottom: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '6px',
    paddingLeft: '52px',
    paddingTop: '4px',
  },
  opacityLabel: {
    fontSize: '10px',
    color: 'var(--text-secondary, #aaa)',
    flexShrink: 0,
    width: '24px',
  },
  opacitySlider: {
    flex: 1,
    accentColor: 'var(--accent, #4dabf7)',
    cursor: 'pointer',
  },
  opacityValue: {
    fontSize: '10px',
    color: 'var(--text-secondary, #aaa)',
    width: '28px',
    textAlign: 'right',
    flexShrink: 0,
  },
  blendSelect: {
    fontSize: '10px',
    background: 'var(--bg-input, #222)',
    color: 'var(--text-primary, #ddd)',
    border: '1px solid var(--border-light, #333)',
    borderRadius: '2px',
    padding: '1px 3px',
    cursor: 'pointer',
    outline: 'none',
  },
  toolbar: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: '4px',
    padding: '4px 8px',
    borderTop: '1px solid var(--border-light, #333)',
  },
  toolBtn: {
    background: 'var(--bg-btn, #2c2c2c)',
    border: '1px solid var(--border-light, #333)',
    borderRadius: '3px',
    color: 'var(--text-secondary, #aaa)',
    cursor: 'pointer',
    padding: '4px 6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.1s, color 0.1s',
  },
  dragOver: {
    borderTop: '2px solid var(--accent, #4dabf7)',
  },
}

function LayerRow({ layer, isActive, reversed, totalLayers }) {
  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState(layer.name)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const setActiveLayer = useEditorStore((s) => s.setActiveLayer)
  const toggleLayerVisibility = useEditorStore((s) => s.toggleLayerVisibility)
  const setLayerOpacity = useEditorStore((s) => s.setLayerOpacity)
  const setLayerBlendMode = useEditorStore((s) => s.setLayerBlendMode)
  const reorderLayers = useEditorStore((s) => s.reorderLayers)
  const renameLayer = useEditorStore((s) => s.renameLayer)

  // reversed index: the panel shows layers in reverse (top = last in array)
  const storeIdx = totalLayers - 1 - reversed

  const handleNameClick = (e) => {
    e.stopPropagation()
    setEditing(true)
    setNameVal(layer.name)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const commitName = () => {
    setEditing(false)
    renameLayer(layer.id, nameVal.trim() || layer.name)
  }

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') commitName()
    if (e.key === 'Escape') setEditing(false)
    e.stopPropagation()
  }

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', String(storeIdx))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (!isNaN(fromIdx) && fromIdx !== storeIdx) {
      reorderLayers(fromIdx, storeIdx)
    }
  }

  const opacityPct = Math.round(layer.opacity * 100)

  return (
    <li
      style={{
        ...css.row(isActive),
        ...(dragOver ? { borderTop: '2px solid var(--accent, #4dabf7)' } : {}),
      }}
      draggable
      onClick={() => setActiveLayer(layer.id)}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div style={css.rowTop}>
        <button
          style={css.eyeBtn}
          onClick={(e) => {
            e.stopPropagation()
            toggleLayerVisibility(layer.id)
          }}
          title={layer.visible ? 'Hide layer' : 'Show layer'}
        >
          {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>

        {layer.thumbnail ? (
          <img
            src={layer.thumbnail}
            alt={layer.name}
            style={css.thumbnail}
            draggable={false}
          />
        ) : (
          <div style={css.thumbnailPlaceholder} />
        )}

        {editing ? (
          <input
            ref={inputRef}
            style={css.nameInput}
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={handleNameKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            style={css.layerName}
            title={layer.name}
            onDoubleClick={handleNameClick}
          >
            {layer.name}
          </span>
        )}
      </div>

      <div style={css.rowBottom}>
        <span style={css.opacityLabel}>Opac</span>
        <input
          type="range"
          min={0}
          max={100}
          value={opacityPct}
          style={css.opacitySlider}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation()
            setLayerOpacity(layer.id, parseInt(e.target.value, 10) / 100)
          }}
        />
        <span style={css.opacityValue}>{opacityPct}%</span>

        <select
          style={css.blendSelect}
          value={layer.blendMode}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation()
            setLayerBlendMode(layer.id, e.target.value)
          }}
        >
          {BLEND_MODES.map((m) => (
            <option key={m} value={m}>
              {m.charAt(0).toUpperCase() + m.slice(1).replace('-', ' ')}
            </option>
          ))}
        </select>
      </div>
    </li>
  )
}

export default function LayersPanel() {
  const layers = useEditorStore((s) => s.layers)
  const activeLayerId = useEditorStore((s) => s.activeLayerId)
  const panelOpen = useEditorStore((s) => s.panels.layers)
  const togglePanel = useEditorStore((s) => s.togglePanel)
  const addLayer = useEditorStore((s) => s.addLayer)
  const removeLayer = useEditorStore((s) => s.removeLayer)
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer)

  // Layers displayed in reverse order (topmost layer first in list)
  const reversedLayers = [...layers].reverse()

  return (
    <PanelContainer
      title="Layers"
      isOpen={panelOpen}
      onToggle={() => togglePanel('layers')}
    >
      <div style={css.container}>
        {layers.length === 0 ? (
          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary, #888)',
              textAlign: 'center',
              padding: '12px 8px',
              margin: 0,
            }}
          >
            No layers yet. Click + to add one.
          </p>
        ) : (
          <ul style={css.list}>
            {reversedLayers.map((layer, reversedIdx) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                isActive={layer.id === activeLayerId}
                reversed={reversedIdx}
                totalLayers={layers.length}
              />
            ))}
          </ul>
        )}

        <div style={css.toolbar}>
          <button
            style={css.toolBtn}
            title="Add layer"
            onClick={() => addLayer(`Layer ${layers.length + 1}`)}
          >
            <Plus size={14} />
          </button>
          <button
            style={css.toolBtn}
            title="Duplicate layer"
            onClick={() => activeLayerId && duplicateLayer(activeLayerId)}
            disabled={!activeLayerId}
          >
            <Copy size={14} />
          </button>
          <button
            style={css.toolBtn}
            title="Remove active layer"
            onClick={() => activeLayerId && removeLayer(activeLayerId)}
            disabled={!activeLayerId}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </PanelContainer>
  )
}
