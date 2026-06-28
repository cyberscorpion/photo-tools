import React from 'react'
import { X, Plus } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore.js'

const barStyle = {
  height: '32px',
  minHeight: '32px',
  background: 'var(--bg-toolbar)',
  borderBottom: '1px solid var(--border)',
  gridArea: 'tabbar',
  display: 'flex',
  alignItems: 'flex-end',
  overflowX: 'auto',
  overflowY: 'hidden',
  userSelect: 'none',
  flexShrink: 0,
}

barStyle['scrollbarWidth'] = 'none'
barStyle['::-webkit-scrollbar'] = { display: 'none' }

export default function TabBar() {
  const tabs       = useEditorStore((s) => s.tabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const switchTab  = useEditorStore((s) => s.switchTab)
  const addTab     = useEditorStore((s) => s.addTab)
  const closeTab   = useEditorStore((s) => s.closeTab)

  return (
    <div style={barStyle}>
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onActivate={() => switchTab(tab.id)}
          onClose={(e) => { e.stopPropagation(); closeTab(tab.id) }}
        />
      ))}

      {/* New tab button */}
      <button
        title="New tab  (Ctrl+T)"
        onClick={() => addTab()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 26,
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          borderRight: '1px solid var(--border)',
          color: 'var(--text-dim)',
          cursor: 'pointer',
          fontSize: 16,
          padding: 0,
          alignSelf: 'flex-end',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-bright)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
      >
        <Plus size={14} />
      </button>
    </div>
  )
}

function Tab({ tab, isActive, onActivate, onClose }) {
  const tabStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingLeft: 10,
    paddingRight: 6,
    flexShrink: 0,
    maxWidth: 180,
    background: isActive ? 'var(--bg-active)' : 'var(--bg-toolbar)',
    borderRight: '1px solid var(--border)',
    borderTop: isActive ? '2px solid var(--accent)' : '2px solid transparent',
    cursor: 'pointer',
    alignSelf: 'flex-end',
    transition: 'background 0.1s',
  }

  const nameStyle = {
    fontSize: 11,
    color: isActive ? 'var(--text-bright)' : 'var(--text-dim)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 120,
    flexShrink: 1,
  }

  const closeBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: 2,
    flexShrink: 0,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    padding: 0,
    opacity: 0.6,
  }

  return (
    <div
      style={tabStyle}
      onClick={onActivate}
      title={tab.name}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'var(--bg-toolbar)'
      }}
    >
      {/* Document icon */}
      <svg
        width="10" height="12" viewBox="0 0 10 12"
        fill="none" style={{ flexShrink: 0, opacity: 0.6 }}
      >
        <path d="M1 1h5l3 3v7H1V1z" stroke="currentColor" strokeWidth="1" fill="none"/>
        <path d="M6 1v3h3" stroke="currentColor" strokeWidth="1"/>
      </svg>

      <span style={nameStyle}>{tab.name}</span>

      <button
        style={closeBtnStyle}
        onClick={onClose}
        title="Close tab"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
          e.currentTarget.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.opacity = '0.6'
        }}
      >
        <X size={10} strokeWidth={2.5} />
      </button>
    </div>
  )
}
