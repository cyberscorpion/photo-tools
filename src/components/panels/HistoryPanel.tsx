import React, { useRef, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import PanelContainer from './PanelContainer.jsx'

function formatTimestamp(ms) {
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

const css = {
  body: {
    background: 'var(--bg-panel)',
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '5px 8px',
    borderBottom: '1px solid var(--border-light, #333)',
  },
  clearBtn: {
    background: 'var(--bg-btn, #2c2c2c)',
    border: '1px solid var(--border-light, #3a3a3a)',
    borderRadius: '3px',
    color: 'var(--text-secondary, #bbb)',
    fontSize: '10px',
    padding: '3px 8px',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: '4px 0',
    maxHeight: '220px',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  entry: (isActive) => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 10px',
    cursor: 'pointer',
    background: isActive ? 'var(--accent, #4dabf7)' : 'transparent',
    color: isActive ? '#000' : 'var(--text-primary, #ddd)',
    transition: 'background 0.1s, color 0.1s',
    borderLeft: isActive ? '3px solid rgba(0,0,0,0.3)' : '3px solid transparent',
  }),
  timestamp: (isActive) => ({
    fontSize: '10px',
    color: isActive ? 'rgba(0,0,0,0.6)' : 'var(--text-secondary, #888)',
    flexShrink: 0,
    fontFamily: 'monospace',
    letterSpacing: '0.02em',
  }),
  label: {
    fontSize: '12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  empty: {
    fontSize: '11px',
    color: 'var(--text-secondary, #888)',
    textAlign: 'center',
    padding: '12px 8px',
  },
}

export default function HistoryPanel() {
  const panelOpen = useEditorStore((s) => s.panels.history)
  const togglePanel = useEditorStore((s) => s.togglePanel)
  const history = useEditorStore((s) => s.history)
  const historyIndex = useEditorStore((s) => s.historyIndex)
  const jumpToHistory = useEditorStore((s) => s.jumpToHistory)

  const activeRef = useRef(null)
  const listRef = useRef(null)

  // Clear history: reset to empty state
  const clearHistory = () => {
    useEditorStore.setState({ history: [], historyIndex: -1 })
  }

  // Auto-scroll to active entry whenever historyIndex or panelOpen changes
  useEffect(() => {
    if (!panelOpen) return
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [historyIndex, panelOpen])

  return (
    <PanelContainer
      title="History"
      isOpen={panelOpen}
      onToggle={() => togglePanel('history')}
    >
      <div style={css.body}>
        <div style={css.topBar}>
          <button
            style={css.clearBtn}
            onClick={clearHistory}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-btn-hover, #383838)'
              e.currentTarget.style.color = 'var(--text-primary, #eee)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-btn, #2c2c2c)'
              e.currentTarget.style.color = 'var(--text-secondary, #bbb)'
            }}
            disabled={history.length === 0}
          >
            Clear History
          </button>
        </div>

        {history.length === 0 ? (
          <p style={css.empty}>No history yet.</p>
        ) : (
          <ul style={css.list} ref={listRef}>
            {history.map((entry, idx) => {
              const isActive = idx === historyIndex
              return (
                <li
                  key={idx}
                  ref={isActive ? activeRef : null}
                  style={css.entry(isActive)}
                  onClick={() => jumpToHistory(idx)}
                  title={entry.label}
                >
                  <span style={css.timestamp(isActive)}>
                    {formatTimestamp(entry.timestamp)}
                  </span>
                  <span style={css.label}>{entry.label}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </PanelContainer>
  )
}
