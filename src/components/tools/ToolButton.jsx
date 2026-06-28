import React, { useState } from 'react'

const tooltipStyle = {
  position: 'absolute',
  left: 'calc(100% + 8px)',
  top: '50%',
  transform: 'translateY(-50%)',
  background: '#1a1a1a',
  border: '1px solid #4a4a4a',
  color: '#cccccc',
  padding: '4px 8px',
  borderRadius: '3px',
  fontSize: '11px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  zIndex: 9999,
}

const shortcutStyle = {
  marginLeft: '6px',
  color: '#888888',
  fontSize: '10px',
}

export default function ToolButton({ tool, isActive, onClick }) {
  const [hovered, setHovered] = useState(false)
  const Icon = tool.icon

  const btnStyle = {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    position: 'relative',
    background: isActive ? 'var(--bg-active)' : 'transparent',
    border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
    color: isActive ? 'var(--text-bright)' : hovered ? 'var(--text-bright)' : 'var(--text)',
    transition: 'background 0.1s, color 0.1s',
    cursor: 'pointer',
  }

  return (
    <button
      style={btnStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title=""
      aria-label={tool.label}
    >
      {Icon && <Icon size={16} />}
      {hovered && (
        <div style={tooltipStyle}>
          {tool.label}
          {tool.shortcut && <span style={shortcutStyle}>{tool.shortcut}</span>}
        </div>
      )}
    </button>
  )
}
