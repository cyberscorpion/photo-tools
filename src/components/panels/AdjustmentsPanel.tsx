import React, { useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import PanelContainer from './PanelContainer.jsx'
import Slider from '../ui/Slider.jsx'
import { applyAdjustments } from '../../canvas/adjustmentEngine.js'
import { getFabric } from '../../canvas/fabricManager.js'

const SLIDERS = [
  { key: 'brightness',  label: 'Brightness',  min: -100, max: 100  },
  { key: 'contrast',    label: 'Contrast',    min: -100, max: 100  },
  { key: 'saturation',  label: 'Saturation',  min: -100, max: 100  },
  { key: 'hue',         label: 'Hue',         min: -180, max: 180  },
  { key: 'exposure',    label: 'Exposure',    min: -50,  max: 50   },
  { key: 'warmth',      label: 'Warmth',      min: -100, max: 100  },
  { key: 'tint',        label: 'Tint',        min: -100, max: 100  },
  { key: 'shadows',     label: 'Shadows',     min: -100, max: 100  },
  { key: 'highlights',  label: 'Highlights',  min: -100, max: 100  },
  { key: 'sharpness',   label: 'Sharpness',   min: 0,    max: 100  },
  { key: 'blur',        label: 'Blur',        min: 0,    max: 100  },
]

// Filter ids are lowercase to match adjustmentEngine.js; display labels are capitalised separately
const FILTERS = [
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'sepia',     label: 'Sepia'     },
  { id: 'invert',    label: 'Invert'    },
  { id: 'vintage',   label: 'Vintage'   },
  { id: 'vignette',  label: 'Vignette'  },
]

const css = {
  body: {
    padding: '8px 10px 10px',
    background: 'var(--bg-panel)',
  },
  sectionTitle: {
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary, #888)',
    marginBottom: '8px',
    marginTop: '0',
  },
  slidersGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  resetBtn: {
    display: 'block',
    width: '100%',
    marginTop: '10px',
    padding: '5px 0',
    background: 'var(--bg-btn, #2c2c2c)',
    border: '1px solid var(--border-light, #3a3a3a)',
    borderRadius: '3px',
    color: 'var(--text-secondary, #bbb)',
    fontSize: '11px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'background 0.15s, color 0.15s',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid var(--border-light, #333)',
    margin: '12px 0 10px',
  },
  filtersTitle: {
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary, #888)',
    marginBottom: '8px',
    marginTop: '0',
  },
  filtersRow: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '5px',
  },
  filterPill: (isActive) => ({
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    cursor: 'pointer',
    border: isActive
      ? '1px solid var(--accent, #4dabf7)'
      : '1px solid var(--border-light, #444)',
    background: isActive ? 'var(--accent, #4dabf7)' : 'var(--bg-btn, #2c2c2c)',
    color: isActive ? '#000' : 'var(--text-secondary, #bbb)',
    fontWeight: isActive ? '600' : '400',
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
    userSelect: 'none',
  }),
}

export default function AdjustmentsPanel() {
  const panelOpen = useEditorStore((s) => s.panels.adjustments)
  const togglePanel = useEditorStore((s) => s.togglePanel)
  const adjustments = useEditorStore((s) => s.adjustments)
  const activeFilters = useEditorStore((s) => s.activeFilters)
  const setAdjustment = useEditorStore((s) => s.setAdjustment)
  const resetAdjustments = useEditorStore((s) => s.resetAdjustments)
  const toggleFilter = useEditorStore((s) => s.toggleFilter)

  // Apply adjustments and filters to the canvas image whenever they change
  useEffect(() => {
    const fc = getFabric()
    if (!fc) return
    const objects = fc.getObjects()
    // Find the base image layer object (first FabricImage with layerId 'background', or first image)
    const imgObject = objects.find(
      (o) => o.type === 'image' && o.layerId === 'background'
    ) ?? objects.find((o) => o.type === 'image')
    if (!imgObject) return
    applyAdjustments(imgObject, adjustments, activeFilters)
  }, [adjustments, activeFilters])

  return (
    <PanelContainer
      title="Adjustments"
      isOpen={panelOpen}
      onToggle={() => togglePanel('adjustments')}
    >
      <div style={css.body}>
        <p style={css.sectionTitle}>Adjustments</p>

        <div style={css.slidersGrid}>
          {SLIDERS.map(({ key, label, min, max }) => (
            <Slider
              key={key}
              label={label}
              value={adjustments[key]}
              min={min}
              max={max}
              step={1}
              onChange={(v) => setAdjustment(key, v)}
            />
          ))}
        </div>

        <button
          style={css.resetBtn}
          onClick={resetAdjustments}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-btn-hover, #383838)'
            e.currentTarget.style.color = 'var(--text-primary, #eee)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-btn, #2c2c2c)'
            e.currentTarget.style.color = 'var(--text-secondary, #bbb)'
          }}
        >
          Reset All
        </button>

        <hr style={css.divider} />

        <p style={css.filtersTitle}>Filters</p>

        <div style={css.filtersRow}>
          {FILTERS.map(({ id, label }) => {
            const isActive = activeFilters.includes(id)
            return (
              <button
                key={id}
                style={css.filterPill(isActive)}
                onClick={() => toggleFilter(id)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </PanelContainer>
  )
}
