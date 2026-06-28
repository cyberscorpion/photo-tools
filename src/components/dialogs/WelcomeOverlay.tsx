import { useRef } from 'react'
import { Camera } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore.js'

export default function WelcomeOverlay({ onFileSelected }) {
  const showWelcome = useEditorStore((s) => s.showWelcome)
  const fileInputRef = useRef(null)

  if (!showWelcome) return null

  const handleFileInput = (e) => {
    const file = e.target.files?.[0]
    if (file) onFileSelected(file)
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (file) onFileSelected(file)
  }

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10,12,18,0.72)',
    backdropFilter: 'blur(2px)',
    zIndex: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'system-ui, sans-serif',
  }

  const contentStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    textAlign: 'center',
    color: '#e0e0e0',
  }

  const iconWrapStyle = {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: 'rgba(70,120,200,0.18)',
    border: '1.5px solid rgba(70,120,200,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  }

  const headingStyle = {
    fontSize: 32,
    fontWeight: 700,
    color: '#f0f0f0',
    margin: 0,
    letterSpacing: '-0.5px',
  }

  const subtitleStyle = {
    fontSize: 15,
    color: '#888',
    margin: 0,
    marginTop: -8,
  }

  const dropZoneStyle = {
    width: 300,
    height: 200,
    border: '2px dashed #555',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    cursor: 'pointer',
    marginTop: 8,
    background: 'rgba(255,255,255,0.03)',
    transition: 'border-color 0.2s, background 0.2s',
    color: '#888',
    fontSize: 13,
  }

  const dropIconStyle = {
    fontSize: 32,
    lineHeight: 1,
    color: '#555',
    marginBottom: 4,
  }

  const dropPrimaryStyle = {
    color: '#b0b0b0',
    fontSize: 14,
    fontWeight: 500,
  }

  const dropSecondaryStyle = {
    color: '#666',
    fontSize: 12,
  }

  const openLinkStyle = {
    color: '#5b9bd5',
    textDecoration: 'underline',
    cursor: 'pointer',
  }

  const handleDropZoneDragOver = (e) => {
    e.preventDefault()
    e.currentTarget.style.borderColor = '#5b9bd5'
    e.currentTarget.style.background = 'rgba(91,155,213,0.07)'
  }

  const handleDropZoneDragLeave = (e) => {
    e.currentTarget.style.borderColor = '#555'
    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
  }

  const handleDropZoneDrop = (e) => {
    e.currentTarget.style.borderColor = '#555'
    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
    handleDrop(e)
  }

  return (
    <div style={overlayStyle} onDragOver={handleDragOver} onDrop={handleDrop}>
      <div style={contentStyle}>
        <div style={iconWrapStyle}>
          <Camera size={36} color="#5b9bd5" strokeWidth={1.5} />
        </div>

        <h1 style={headingStyle}>Photo Tools</h1>
        <p style={subtitleStyle}>Professional Photo Editor</p>

        <div
          style={dropZoneStyle}
          onClick={handleClick}
          onDragOver={handleDropZoneDragOver}
          onDragLeave={handleDropZoneDragLeave}
          onDrop={handleDropZoneDrop}
          role="button"
          tabIndex={0}
          aria-label="Drop image here or click to open"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
        >
          <span style={dropIconStyle}>&#x1F4C2;</span>
          <span style={dropPrimaryStyle}>Drop image here</span>
          <span style={dropSecondaryStyle}>
            or{' '}
            <span style={openLinkStyle}>Click to Open</span>
          </span>
          <span style={dropSecondaryStyle}>PNG, JPEG, WebP, GIF, BMP</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
      </div>
    </div>
  )
}
