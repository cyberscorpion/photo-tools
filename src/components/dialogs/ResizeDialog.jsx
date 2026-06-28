import { useState, useEffect } from 'react'
import Modal from '../ui/Modal.jsx'
import { useEditorStore } from '../../store/editorStore.js'
import { getFabric } from '../../canvas/fabricManager.js'

export default function ResizeDialog({ isOpen, onClose }) {
  const imageSize = useEditorStore((s) => s.imageSize)
  const setImageSize = useEditorStore((s) => s.setImageSize)

  const currentW = imageSize.w || 0
  const currentH = imageSize.h || 0

  const [unit, setUnit] = useState('px')
  const [lockAspect, setLockAspect] = useState(true)
  const [widthVal, setWidthVal] = useState(String(currentW))
  const [heightVal, setHeightVal] = useState(String(currentH))

  // Sync inputs when dialog opens or imageSize changes
  useEffect(() => {
    if (isOpen) {
      if (unit === 'px') {
        setWidthVal(String(currentW))
        setHeightVal(String(currentH))
      } else {
        setWidthVal('100')
        setHeightVal('100')
      }
    }
  }, [isOpen, currentW, currentH])

  const aspectRatio = currentH > 0 ? currentW / currentH : 1

  const handleWidthChange = (val) => {
    setWidthVal(val)
    if (lockAspect) {
      const numW = parseFloat(val)
      if (!isNaN(numW) && numW > 0) {
        if (unit === 'px') {
          setHeightVal(String(Math.round(numW / aspectRatio)))
        } else {
          setHeightVal(val) // proportional % is always equal
        }
      }
    }
  }

  const handleHeightChange = (val) => {
    setHeightVal(val)
    if (lockAspect) {
      const numH = parseFloat(val)
      if (!isNaN(numH) && numH > 0) {
        if (unit === 'px') {
          setWidthVal(String(Math.round(numH * aspectRatio)))
        } else {
          setWidthVal(val)
        }
      }
    }
  }

  const handleUnitChange = (newUnit) => {
    if (newUnit === unit) return
    if (newUnit === '%') {
      // Convert current px values to %
      const wPct = currentW > 0 ? Math.round((parseFloat(widthVal) / currentW) * 100) : 100
      const hPct = currentH > 0 ? Math.round((parseFloat(heightVal) / currentH) * 100) : 100
      setWidthVal(String(wPct))
      setHeightVal(String(hPct))
    } else {
      // Convert % back to px
      const wPx = Math.round((parseFloat(widthVal) / 100) * currentW)
      const hPx = Math.round((parseFloat(heightVal) / 100) * currentH)
      setWidthVal(String(wPx || currentW))
      setHeightVal(String(hPx || currentH))
    }
    setUnit(newUnit)
  }

  const handleConfirm = () => {
    let newW = parseFloat(widthVal)
    let newH = parseFloat(heightVal)

    if (isNaN(newW) || isNaN(newH) || newW <= 0 || newH <= 0) return

    if (unit === '%') {
      newW = Math.round((newW / 100) * currentW)
      newH = Math.round((newH / 100) * currentH)
    } else {
      newW = Math.round(newW)
      newH = Math.round(newH)
    }

    newW = Math.max(1, Math.min(10000, newW))
    newH = Math.max(1, Math.min(10000, newH))

    const fc = getFabric()
    if (fc) {
      fc.setWidth(newW)
      fc.setHeight(newH)
      fc.renderAll()
    }
    setImageSize({ w: newW, h: newH })
    onClose()
  }

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 6,
    fontFamily: 'system-ui, sans-serif',
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  }

  const fieldLabelStyle = {
    width: 52,
    fontSize: 12,
    color: '#b0b0b0',
    fontFamily: 'system-ui, sans-serif',
    flexShrink: 0,
  }

  const inputStyle = {
    flex: 1,
    background: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: 3,
    color: '#e0e0e0',
    fontSize: 13,
    fontFamily: 'system-ui, sans-serif',
    padding: '5px 8px',
    outline: 'none',
    MozAppearance: 'textfield',
  }

  const unitSuffix = {
    fontSize: 12,
    color: '#666',
    fontFamily: 'system-ui, sans-serif',
    width: 20,
    flexShrink: 0,
    textAlign: 'center',
  }

  const infoStyle = {
    fontSize: 11,
    color: '#666',
    fontFamily: 'system-ui, sans-serif',
    marginBottom: 14,
    padding: '6px 8px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 3,
  }

  const checkRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    cursor: 'pointer',
    userSelect: 'none',
  }

  const checkLabelStyle = {
    fontSize: 13,
    color: '#c0c0c0',
    fontFamily: 'system-ui, sans-serif',
  }

  const getUnitBtnStyle = (u) => ({
    padding: '4px 14px',
    background: unit === u ? '#3d5a8a' : '#363636',
    border: unit === u ? '1px solid #5b9bd5' : '1px solid #444',
    borderRadius: 3,
    color: unit === u ? '#fff' : '#aaa',
    fontSize: 12,
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
    fontWeight: unit === u ? 600 : 400,
    transition: 'all 0.15s',
  })

  const footerStyle = {
    display: 'flex',
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTop: '1px solid var(--border, #444)',
  }

  const primaryBtnStyle = {
    flex: 1,
    padding: '8px 0',
    background: '#3d5a8a',
    border: '1px solid #5b9bd5',
    borderRadius: 4,
    color: '#fff',
    fontSize: 13,
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
    fontWeight: 600,
  }

  const cancelBtnStyle = {
    flex: 1,
    padding: '8px 0',
    background: '#383838',
    border: '1px solid #555',
    borderRadius: 4,
    color: '#c0c0c0',
    fontSize: 13,
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resize Canvas" width="360px">
      <div style={infoStyle}>
        Current size: <strong style={{ color: '#b0b0b0' }}>{currentW} x {currentH} px</strong>
      </div>

      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Unit</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={getUnitBtnStyle('px')} onClick={() => handleUnitChange('px')}>px</button>
          <button style={getUnitBtnStyle('%')} onClick={() => handleUnitChange('%')}>%</button>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Dimensions</span>

        <div style={rowStyle}>
          <span style={fieldLabelStyle}>Width</span>
          <input
            type="number"
            style={inputStyle}
            value={widthVal}
            onChange={(e) => handleWidthChange(e.target.value)}
            min={1}
            max={unit === '%' ? 10000 : 10000}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#5b9bd5')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#444')}
          />
          <span style={unitSuffix}>{unit}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 4, paddingLeft: 60 }}>
          <span
            style={{
              fontSize: 16,
              color: lockAspect ? '#5b9bd5' : '#555',
              cursor: 'pointer',
              lineHeight: 1,
              userSelect: 'none',
            }}
            title={lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            onClick={() => setLockAspect((v) => !v)}
          >
            {lockAspect ? '🔒' : '🔓'}
          </span>
        </div>

        <div style={rowStyle}>
          <span style={fieldLabelStyle}>Height</span>
          <input
            type="number"
            style={inputStyle}
            value={heightVal}
            onChange={(e) => handleHeightChange(e.target.value)}
            min={1}
            max={unit === '%' ? 10000 : 10000}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#5b9bd5')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#444')}
          />
          <span style={unitSuffix}>{unit}</span>
        </div>
      </div>

      <label style={checkRowStyle} htmlFor="lock-aspect">
        <input
          id="lock-aspect"
          type="checkbox"
          checked={lockAspect}
          onChange={(e) => setLockAspect(e.target.checked)}
          style={{ accentColor: '#5b9bd5', width: 14, height: 14, cursor: 'pointer' }}
        />
        <span style={checkLabelStyle}>Lock aspect ratio</span>
      </label>

      <div style={footerStyle}>
        <button
          style={primaryBtnStyle}
          onClick={handleConfirm}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#4a6fa5')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#3d5a8a')}
        >
          Apply
        </button>
        <button
          style={cancelBtnStyle}
          onClick={onClose}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#424242')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#383838')}
        >
          Cancel
        </button>
      </div>
    </Modal>
  )
}
