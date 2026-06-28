import { useState } from 'react'

const PLACEMENTS = {
  right: {
    top: '50%',
    left: '100%',
    transform: 'translateY(-50%)',
    marginLeft: 8,
  },
  left: {
    top: '50%',
    right: '100%',
    transform: 'translateY(-50%)',
    marginRight: 8,
  },
  top: {
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: 8,
  },
  bottom: {
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: 8,
  },
}

export default function Tooltip({ children, text, placement = 'right' }) {
  const [visible, setVisible] = useState(false)

  const wrapperStyle = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const tooltipStyle = {
    position: 'absolute',
    ...PLACEMENTS[placement] || PLACEMENTS.right,
    background: 'rgba(20,20,20,0.95)',
    color: '#e8e8e8',
    fontSize: 11,
    fontFamily: 'system-ui, sans-serif',
    padding: '4px 8px',
    borderRadius: 3,
    border: '1px solid #555',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 9999,
    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
    lineHeight: 1.4,
  }

  return (
    <span
      style={wrapperStyle}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && text && (
        <span style={tooltipStyle} role="tooltip">
          {text}
        </span>
      )}
    </span>
  )
}
