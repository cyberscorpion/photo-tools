import { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Slider from '../ui/Slider.jsx'
import { useEditorStore } from '../../store/editorStore.js'
import { downloadImage, copyToClipboard } from '../../canvas/exportEngine.js'

const FORMATS = ['png', 'jpeg', 'webp']

export default function ExportDialog({ isOpen, onClose }) {
  const fileName = useEditorStore((s) => s.fileName)

  const defaultName = fileName
    ? fileName.replace(/\.[^.]+$/, '')
    : 'photo-tools-export'

  const [format, setFormat] = useState('png')
  const [quality, setQuality] = useState(92)
  const [exportName, setExportName] = useState(defaultName)
  const [copyStatus, setCopyStatus] = useState(null) // null | 'copying' | 'copied' | 'error'

  const showQuality = format === 'jpeg' || format === 'webp'

  const handleDownload = () => {
    try {
      downloadImage(format, quality, exportName || 'photo-tools-export')
    } catch (err) {
      if (import.meta.env.DEV) console.error('Export failed:', err)
    }
  }

  const handleCopy = async () => {
    setCopyStatus('copying')
    try {
      await copyToClipboard()
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus(null), 2000)
    } catch (err) {
      if (import.meta.env.DEV) console.error('Copy failed:', err)
      setCopyStatus('error')
      setTimeout(() => setCopyStatus(null), 2500)
    }
  }

  const sectionStyle = {
    marginBottom: 16,
  }

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 8,
    fontFamily: 'system-ui, sans-serif',
  }

  const toggleGroupStyle = {
    display: 'flex',
    gap: 4,
  }

  const getFormatBtnStyle = (f) => ({
    flex: 1,
    padding: '6px 0',
    background: format === f ? '#3d5a8a' : '#363636',
    border: format === f ? '1px solid #5b9bd5' : '1px solid #444',
    borderRadius: 3,
    color: format === f ? '#fff' : '#aaa',
    fontSize: 12,
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
    fontWeight: format === f ? 600 : 400,
    transition: 'all 0.15s',
    letterSpacing: '0.03em',
  })

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    background: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: 3,
    color: '#e0e0e0',
    fontSize: 13,
    fontFamily: 'system-ui, sans-serif',
    padding: '6px 8px',
    outline: 'none',
  }

  const footerStyle = {
    display: 'flex',
    gap: 8,
    marginTop: 20,
    paddingTop: 14,
    borderTop: '1px solid var(--border, #444)',
  }

  const primaryBtnStyle = {
    flex: 1,
    padding: '8px 0',
    background: '#3d5a8a',
    border: '1px solid #5b9bd5',
    borderRadius: 4,
    color: '#fff',
    fontSize: 13,
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'background 0.15s',
  }

  const secondaryBtnStyle = {
    flex: 1,
    padding: '8px 0',
    background: '#383838',
    border: '1px solid #555',
    borderRadius: 4,
    color: '#c0c0c0',
    fontSize: 13,
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
    transition: 'background 0.15s',
  }

  const getCopyLabel = () => {
    if (copyStatus === 'copying') return 'Copying...'
    if (copyStatus === 'copied') return 'Copied!'
    if (copyStatus === 'error') return 'Failed'
    return 'Copy to Clipboard'
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Image" width="360px">
      <div style={sectionStyle}>
        <span style={labelStyle}>Format</span>
        <div style={toggleGroupStyle}>
          {FORMATS.map((f) => (
            <button
              key={f}
              style={getFormatBtnStyle(f)}
              onClick={() => setFormat(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {showQuality && (
        <div style={sectionStyle}>
          <span style={labelStyle}>Quality</span>
          <Slider
            label="Quality"
            value={quality}
            min={1}
            max={100}
            step={1}
            onChange={setQuality}
          />
        </div>
      )}

      <div style={sectionStyle}>
        <label style={labelStyle} htmlFor="export-filename">
          File Name
        </label>
        <input
          id="export-filename"
          type="text"
          style={inputStyle}
          value={exportName}
          onChange={(e) => setExportName(e.target.value)}
          placeholder="photo-tools-export"
          onFocus={(e) => (e.currentTarget.style.borderColor = '#5b9bd5')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#444')}
        />
      </div>

      <div style={footerStyle}>
        <button
          style={primaryBtnStyle}
          onClick={handleDownload}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#4a6fa5')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#3d5a8a')}
        >
          Download
        </button>
        <button
          style={{
            ...secondaryBtnStyle,
            ...(copyStatus === 'copied' ? { borderColor: '#4caf50', color: '#81c784' } : {}),
            ...(copyStatus === 'error' ? { borderColor: '#e57373', color: '#e57373' } : {}),
          }}
          onClick={handleCopy}
          disabled={copyStatus === 'copying'}
          onMouseEnter={(e) => {
            if (!copyStatus) e.currentTarget.style.background = '#424242'
          }}
          onMouseLeave={(e) => {
            if (!copyStatus) e.currentTarget.style.background = '#383838'
          }}
        >
          {getCopyLabel()}
        </button>
      </div>
    </Modal>
  )
}
