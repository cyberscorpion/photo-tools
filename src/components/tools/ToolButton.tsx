import React, { useState, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'

export default function ToolButton({
  tool,
  isActive,
  onClick,
}: {
  tool: { id: string; icon: React.ComponentType<{ size?: number }>; label: string; shortcut: string }
  isActive: boolean
  onClick: () => void
}) {
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const Icon = tool.icon

  const handleMouseEnter = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setTooltipPos({
      top:  rect.top + rect.height / 2,
      left: rect.right + 10,
    })
  }, [])

  const handleMouseLeave = useCallback(() => setTooltipPos(null), [])

  const btnStyle: React.CSSProperties = {
    width: '36px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '3px',
    position: 'relative',
    background: isActive ? 'var(--bg-active)' : 'transparent',
    border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
    color: isActive ? 'var(--text-bright)' : tooltipPos ? 'var(--text-bright)' : 'var(--text)',
    transition: 'background 0.1s, color 0.1s',
    cursor: 'pointer',
    flexShrink: 0,
  }

  const tooltip = tooltipPos
    ? ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left,
            transform: 'translateY(-50%)',
            background: '#1e1e1e',
            border: '1px solid #4a4a4a',
            color: '#e0e0e0',
            padding: '5px 9px',
            borderRadius: '4px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 99999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            letterSpacing: '0.1px',
          }}
        >
          {tool.label}
          {tool.shortcut && (
            <span style={{ marginLeft: 6, color: '#aaa', fontSize: '10px' }}>
              ({tool.shortcut})
            </span>
          )}
        </div>,
        document.body
      )
    : null

  return (
    <>
      <button
        ref={btnRef}
        style={btnStyle}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title=""
        aria-label={`${tool.label} (${tool.shortcut})`}
      >
        {Icon && <Icon size={15} />}
      </button>
      {tooltip}
    </>
  )
}
