import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

const styles = {
  wrapper: {
    borderBottom: '1px solid var(--border-light)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    cursor: 'pointer',
    background: 'var(--bg-panel)',
    userSelect: 'none',
    transition: 'background 0.15s',
  },
  headerTitle: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary, #aaa)',
  },
  icon: {
    color: 'var(--text-secondary, #aaa)',
    flexShrink: 0,
  },
  body: {
    overflow: 'hidden',
  },
}

export default function PanelContainer({ title, isOpen, onToggle, children }) {
  const [hovered, setHovered] = React.useState(false)

  const headerStyle = {
    ...styles.header,
    background: hovered ? 'var(--bg-panel-hover, #2a2a2a)' : 'var(--bg-panel)',
  }

  return (
    <div style={styles.wrapper}>
      <div
        style={headerStyle}
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-expanded={isOpen}
      >
        <span style={styles.headerTitle}>{title}</span>
        <span style={styles.icon}>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </div>
      <div
        style={{
          ...styles.body,
          display: isOpen ? 'block' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}
