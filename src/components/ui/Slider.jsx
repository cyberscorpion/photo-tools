import { useState } from 'react'

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    gap: 4,
    userSelect: 'none',
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  label: {
    fontSize: 12,
    color: '#b0b0b0',
    fontFamily: 'system-ui, sans-serif',
    flexShrink: 0,
  },
  input: {
    width: 44,
    background: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: 3,
    color: '#e0e0e0',
    fontSize: 12,
    fontFamily: 'system-ui, sans-serif',
    textAlign: 'right',
    padding: '1px 4px',
    outline: 'none',
    MozAppearance: 'textfield',
  },
}

const rangeStyle = `
.ps-slider-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: #3a3a3a;
  outline: none;
  cursor: pointer;
}
.ps-slider-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #c8c8c8;
  border: 1px solid #888;
  cursor: pointer;
  transition: background 0.15s;
}
.ps-slider-range::-webkit-slider-thumb:hover {
  background: #ffffff;
}
.ps-slider-range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #c8c8c8;
  border: 1px solid #888;
  cursor: pointer;
}
.ps-slider-range::-moz-range-track {
  background: #3a3a3a;
  height: 4px;
  border-radius: 2px;
}
.ps-slider-input::-webkit-outer-spin-button,
.ps-slider-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
`

// Inject styles once
if (typeof document !== 'undefined' && !document.getElementById('ps-slider-styles')) {
  const tag = document.createElement('style')
  tag.id = 'ps-slider-styles'
  tag.textContent = rangeStyle
  document.head.appendChild(tag)
}

export default function Slider({ label, value, min, max, step = 1, onChange }) {
  const [inputVal, setInputVal] = useState(String(Math.round(value)))

  const clamp = (v) => Math.min(max, Math.max(min, v))

  const handleRangeChange = (e) => {
    const v = Number(e.target.value)
    setInputVal(String(Math.round(v)))
    onChange(v)
  }

  const handleInputChange = (e) => {
    setInputVal(e.target.value)
  }

  const handleInputBlur = () => {
    const parsed = parseFloat(inputVal)
    if (!isNaN(parsed)) {
      const clamped = clamp(parsed)
      setInputVal(String(Math.round(clamped)))
      onChange(clamped)
    } else {
      setInputVal(String(Math.round(value)))
    }
  }

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur()
    if (e.key === 'Escape') {
      setInputVal(String(Math.round(value)))
      e.target.blur()
    }
  }

  // Keep input in sync when value changes externally
  const rounded = String(Math.round(value))
  if (inputVal !== rounded && document.activeElement?.dataset?.sliderInput !== 'true') {
    // only sync if input not focused
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.row}>
        <span style={styles.label}>{label}</span>
        <input
          type="number"
          className="ps-slider-input"
          data-slider-input="true"
          style={styles.input}
          value={inputVal}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          min={min}
          max={max}
          step={step}
        />
      </div>
      <input
        type="range"
        className="ps-slider-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleRangeChange}
      />
    </div>
  )
}
