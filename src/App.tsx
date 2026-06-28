import './App.css'
import AppShell from './components/layout/AppShell.jsx'
import WelcomeOverlay from './components/dialogs/WelcomeOverlay.jsx'
import { useEditorStore } from './store/editorStore.js'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'
import { useFileOpen } from './hooks/useFileOpen.js'

export default function App() {
  useKeyboardShortcuts()
  const { openFile, fileInputRef } = useFileOpen()
  const showWelcome = useEditorStore(s => s.showWelcome)
  return (
    <div className="app">
      <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={e => openFile(e.target.files[0])} />
      <AppShell onOpenFile={() => fileInputRef.current?.click()} />
      {showWelcome && <WelcomeOverlay onFileSelected={openFile} />}
    </div>
  )
}
