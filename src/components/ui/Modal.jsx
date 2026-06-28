import { useEffect } from 'react'
import ReactDOM from 'react-dom'

export default function Modal({ isOpen, onClose, title, children, width = '400px' }) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const backdropStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const dialogStyle = {
    width,
    maxWidth: '95vw',
    maxHeight: '90vh',
    background: 'var(--bg-panel, #2b2b2b)',
    border: '1px solid var(--border, #444)',
    borderRadius: 6,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: 'system-ui, sans-serif',
  }

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: '1px solid var(--border, #444)',
    background: 'var(--bg-toolbar, #323232)',
    flexShrink: 0,
  }

  const titleStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: '#d0d0d0',
    margin: 0,
  }

  const closeBtnStyle = {
    background: 'none',
    border: 'none',
    color: '#a0a0a0',
    fontSize: 18,
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    transition: 'color 0.15s, background 0.15s',
  }

  const bodyStyle = {
    padding: '16px',
    overflowY: 'auto',
    flex: 1,
    color: '#d0d0d0',
  }

  return ReactDOM.createPortal(
    <div style={backdropStyle} onClick={handleBackdropClick} role="presentation">
      <div
        style={dialogStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div style={headerStyle}>
          <h2 id="modal-title" style={titleStyle}>{title}</h2>
          <button
            style={closeBtnStyle}
            onClick={onClose}
            aria-label="Close dialog"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff'
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#a0a0a0'
              e.currentTarget.style.background = 'none'
            }}
          >
            &#x2715;
          </button>
        </div>
        <div style={bodyStyle}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
