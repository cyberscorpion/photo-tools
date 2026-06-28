import React, { useState, useCallback } from 'react'
import MenuBar from './MenuBar.jsx'
import OptionsBar from './OptionsBar.jsx'
import TabBar from './TabBar.jsx'
import ToolBar from './ToolBar.jsx'
import WorkspaceArea from './WorkspaceArea.jsx'
import StatusBar from './StatusBar.jsx'
import LayersPanel from '../panels/LayersPanel.jsx'
import AdjustmentsPanel from '../panels/AdjustmentsPanel.jsx'
import HistogramPanel from '../panels/HistogramPanel.jsx'
import HistoryPanel from '../panels/HistoryPanel.jsx'
import ContourPanel from '../panels/ContourPanel.jsx'

const shellStyle = {
  display: 'grid',
  gridTemplateAreas: `
    "menubar    menubar    menubar"
    "optionsbar optionsbar optionsbar"
    "tabbar     tabbar     tabbar"
    "toolbar    workspace  panels"
    "statusbar  statusbar  statusbar"
  `,
  gridTemplateColumns: 'var(--toolbar-w) 1fr var(--panel-w)',
  gridTemplateRows: 'var(--menubar-h) var(--optionsbar-h) 32px 1fr var(--statusbar-h)',
  height: '100vh',
  overflow: 'hidden',
}

const panelsSidebarStyle = {
  gridArea: 'panels',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  overflowX: 'hidden',
  background: 'var(--bg-panel)',
  borderLeft: '1px solid var(--border)',
}

export default function AppShell() {
  const [cursorX, setCursorX] = useState(0)
  const [cursorY, setCursorY] = useState(0)

  const handleCursorMove = useCallback((x, y) => {
    setCursorX(x)
    setCursorY(y)
  }, [])

  return (
    <div style={shellStyle}>
      <MenuBar />
      <OptionsBar />
      <TabBar />
      <ToolBar />
      <WorkspaceArea onCursorMove={handleCursorMove} />
      <div style={panelsSidebarStyle}>
        <LayersPanel />
        <AdjustmentsPanel />
        <ContourPanel />
        <HistogramPanel />
        <HistoryPanel />
      </div>
      <StatusBar cursorX={cursorX} cursorY={cursorY} />
    </div>
  )
}
