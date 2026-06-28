import { useState, useEffect, useRef } from 'react'

export default function DropdownMenu({ trigger, items }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const containerStyle = {
    position: 'relative',
    display: 'inline-block',
    fontFamily: 'system-ui, sans-serif',
  }

  const triggerBtnStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
  }

  const menuStyle = {
    position: 'absolute',
    top: '100%',
    left: 0,
    minWidth: 180,
    background: 'var(--bg-menu, #2f2f2f)',
    border: '1px solid var(--border, #444)',
    borderRadius: 4,
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    zIndex: 2000,
    paddingTop: 4,
    paddingBottom: 4,
    marginTop: 2,
    listStyle: 'none',
    margin: 0,
    padding: '4px 0',
  }

  const itemBaseStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 16px',
    fontSize: 13,
    color: '#d0d0d0',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    background: 'none',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    fontFamily: 'system-ui, sans-serif',
  }

  const shortcutStyle = {
    fontSize: 11,
    color: '#777',
    marginLeft: 24,
    flexShrink: 0,
  }

  const separatorStyle = {
    height: 1,
    background: 'var(--border, #444)',
    margin: '4px 8px',
    border: 'none',
  }

  const handleItemClick = (item) => {
    if (item.action) item.action()
    setOpen(false)
  }

  return (
    <div style={containerStyle} ref={containerRef}>
      <button
        style={triggerBtnStyle}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </button>

      {open && (
        <div style={menuStyle} role="menu">
          {items.map((item, idx) => {
            if (item.separator) {
              return <hr key={idx} style={separatorStyle} />
            }
            return (
              <button
                key={idx}
                style={itemBaseStyle}
                role="menuitem"
                onClick={() => handleItemClick(item)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover, #3d5a8a)'
                  e.currentTarget.style.color = '#ffffff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none'
                  e.currentTarget.style.color = '#d0d0d0'
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span style={shortcutStyle}>{item.shortcut}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
