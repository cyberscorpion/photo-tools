import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import ExportDialog from '../dialogs/ExportDialog.jsx'
import ResizeDialog from '../dialogs/ResizeDialog.jsx'
import { getFabric } from '../../canvas/fabricManager.js'
import { copyToClipboard } from '../../canvas/exportEngine.js'

const menuBarStyle = {
  height: 'var(--menubar-h)',
  background: 'var(--bg-toolbar)',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  gridArea: 'menubar',
  userSelect: 'none',
  position: 'relative',
  zIndex: 100,
}

const menuBtnStyle = (open) => ({
  height: '100%',
  padding: '0 10px',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  background: open ? 'var(--bg-active)' : 'transparent',
  color: open ? 'var(--text-bright)' : 'var(--text)',
  cursor: 'pointer',
  border: 'none',
  outline: 'none',
})

const dropdownStyle = {
  position: 'absolute',
  top: '100%',
  left: 0,
  minWidth: '200px',
  background: 'var(--bg-menu)',
  border: '1px solid var(--border)',
  borderTop: 'none',
  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  zIndex: 9999,
}

const itemStyle = {
  display: 'block',
  width: '100%',
  padding: '5px 16px',
  fontSize: '12px',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  color: 'var(--text)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const separatorStyle = {
  height: '1px',
  background: 'var(--border)',
  margin: '3px 0',
}

const shortcutStyle = {
  marginLeft: 'auto',
  paddingLeft: '24px',
  fontSize: '11px',
  color: 'var(--text-dim)',
}

function MenuItem({ label, shortcut, onClick, disabled }) {
  const [hovered, setHovered] = useState(false)
  if (label === '──') return <div style={separatorStyle} />
  return (
    <button
      style={{
        ...itemStyle,
        background: hovered && !disabled ? 'var(--bg-hover)' : 'transparent',
        color: disabled ? 'var(--text-dim)' : 'var(--text)',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={disabled ? undefined : onClick}
    >
      <span>{label}</span>
      {shortcut && <span style={shortcutStyle}>{shortcut}</span>}
    </button>
  )
}

function MenuDropdown({ label, items, openMenu, setOpenMenu }) {
  const menuId = label
  const isOpen = openMenu === menuId
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, setOpenMenu])

  return (
    <div ref={wrapRef} style={{ position: 'relative', height: '100%' }}>
      <button
        style={menuBtnStyle(isOpen)}
        onClick={() => setOpenMenu(isOpen ? null : menuId)}
        onMouseEnter={() => openMenu && openMenu !== menuId && setOpenMenu(menuId)}
      >
        {label}
      </button>
      {isOpen && (
        <div style={dropdownStyle}>
          {items.map((item, idx) =>
            item.label === '──' ? (
              <div key={idx} style={separatorStyle} />
            ) : (
              <MenuItem
                key={idx}
                label={item.label}
                shortcut={item.shortcut}
                disabled={item.disabled}
                onClick={() => {
                  setOpenMenu(null)
                  item.action && item.action()
                }}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

export default function MenuBar() {
  const [openMenu, setOpenMenu] = useState(null)
  const [showExport, setShowExport] = useState(false)
  const [showResize, setShowResize] = React.useState(false)
  const fileInputRef = useRef(null)

  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const toggleFilter = useEditorStore((s) => s.toggleFilter)
  const togglePanel = useEditorStore((s) => s.togglePanel)
  const setZoom = useEditorStore((s) => s.setZoom)
  const zoom = useEditorStore((s) => s.zoom)
  const openFile = useEditorStore((s) => s.openFile)
  const setFileName = useEditorStore((s) => s.setFileName)
  const setImageSize = useEditorStore((s) => s.setImageSize)
  const pushHistory = useEditorStore((s) => s.pushHistory)

  const handleOpenImage = useCallback(() => {
    fileInputRef.current && fileInputRef.current.click()
  }, [])

  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      openFile(file)
      setFileName(file.name)

      // Read file as a data URL so we never face a revoked object URL race condition
      const reader = new FileReader()
      reader.onload = (evt) => {
        const dataURL = evt.target.result
        const img = new Image()
        img.onload = () => {
          setImageSize({ w: img.naturalWidth, h: img.naturalHeight })

          // Load image onto Fabric canvas using the stable dataURL
          const fc = getFabric()
          if (fc) {
            import('fabric').then(({ FabricImage }) => {
              FabricImage.fromURL(dataURL).then((fabricImg) => {
                fc.setWidth(img.naturalWidth)
                fc.setHeight(img.naturalHeight)
                fabricImg.set({ left: 0, top: 0, selectable: false, evented: false })
                fc.add(fabricImg)
                fc.sendObjectToBack(fabricImg)
                fc.renderAll()
              }).catch(() => {})
            }).catch(() => {})
          }
        }
        img.src = dataURL
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    [openFile, setFileName, setImageSize]
  )

  const handleCopyToClipboard = useCallback(() => {
    copyToClipboard().catch(() => {})
  }, [])

  const handleResetCanvas = useCallback(() => {
    const fc = getFabric()
    if (fc) {
      fc.clear()
      fc.renderAll()
    }
  }, [])

  const handleSelectAll = useCallback(() => {
    const fc = getFabric()
    if (!fc) return
    const objects = fc.getObjects()
    fc.discardActiveObject()
    if (objects.length > 0) {
      import('fabric').then(({ ActiveSelection }) => {
        const sel = new ActiveSelection(objects, { canvas: fc })
        fc.setActiveObject(sel)
        fc.requestRenderAll()
      }).catch(() => {})
    }
  }, [])

  const handleDeselect = useCallback(() => {
    const fc = getFabric()
    if (fc) {
      fc.discardActiveObject()
      fc.renderAll()
    }
  }, [])

  const handleDeleteSelected = useCallback(() => {
    const fc = getFabric()
    if (!fc) return
    const active = fc.getActiveObjects()
    active.forEach((obj) => fc.remove(obj))
    fc.discardActiveObject()
    fc.renderAll()
  }, [])

  const applyCanvasTransform = useCallback(async (transformFn, label) => {
    const fc = getFabric()
    if (!fc || fc.width === 0) return
    const w = fc.width, h = fc.height
    const srcDataURL = fc.toDataURL({ format: 'png', multiplier: 1 })
    const img = new Image()
    img.onload = async () => {
      const [nw, nh] = label.includes('Rotate') ? [h, w] : [w, h]
      const off = document.createElement('canvas')
      off.width = nw; off.height = nh
      const ctx = off.getContext('2d')
      transformFn(ctx, img, w, h, nw, nh)
      const dataURL = off.toDataURL('image/png')
      fc.clear()
      fc.setWidth(nw); fc.setHeight(nh)
      setImageSize({ w: nw, h: nh })
      const { FabricImage } = await import('fabric')
      const fImg = await FabricImage.fromURL(dataURL)
      fImg.set({ left: 0, top: 0, selectable: false, evented: false, layerId: 'background' })
      fc.add(fImg); fc.renderAll()
      pushHistory(label, fc.toJSON(['customId', 'layerId']))
    }
    img.src = srcDataURL
  }, [setImageSize, pushHistory])

  const handleFlipHorizontal = useCallback(() => {
    applyCanvasTransform((ctx, img, w, h) => {
      ctx.save(); ctx.scale(-1, 1); ctx.drawImage(img, -w, 0); ctx.restore()
    }, 'Flip Horizontal')
  }, [applyCanvasTransform])

  const handleFlipVertical = useCallback(() => {
    applyCanvasTransform((ctx, img, w, h) => {
      ctx.save(); ctx.scale(1, -1); ctx.drawImage(img, 0, -h); ctx.restore()
    }, 'Flip Vertical')
  }, [applyCanvasTransform])

  const handleRotateCW = useCallback(() => {
    applyCanvasTransform((ctx, img, w, h, nw, nh) => {
      ctx.translate(nw, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(img, 0, 0)
    }, 'Rotate 90° CW')
  }, [applyCanvasTransform])

  const handleRotateCCW = useCallback(() => {
    applyCanvasTransform((ctx, img, w, h, nw, nh) => {
      ctx.translate(0, nh); ctx.rotate(-Math.PI / 2); ctx.drawImage(img, 0, 0)
    }, 'Rotate 90° CCW')
  }, [applyCanvasTransform])

  const applyZoom = useCallback((newZoom) => {
    setZoom(newZoom)
    const fc = getFabric()
    if (fc) {
      fc.setZoom(newZoom)
      fc.renderAll()
    }
  }, [setZoom])

  const handleFitToScreen = useCallback(() => {
    applyZoom(1.0)
  }, [applyZoom])

  const menus = [
    {
      label: 'File',
      items: [
        { label: 'Open Image...', action: handleOpenImage },
        { label: 'Export As...', action: () => setShowExport(true) },
        { label: 'Copy to Clipboard', action: handleCopyToClipboard },
        { label: '──' },
        { label: 'Reset Canvas', action: handleResetCanvas },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => undo() },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: () => redo() },
        { label: '──' },
        { label: 'Select All', action: handleSelectAll },
        { label: 'Deselect', action: handleDeselect },
        { label: 'Delete Selected', action: handleDeleteSelected },
      ],
    },
    {
      label: 'Image',
      items: [
        { label: 'Flip Horizontal', action: handleFlipHorizontal },
        { label: 'Flip Vertical', action: handleFlipVertical },
        { label: 'Rotate 90° CW', action: handleRotateCW },
        { label: 'Rotate 90° CCW', action: handleRotateCCW },
        { label: '──' },
        { label: 'Resize Canvas...', action: () => setShowResize(true) },
      ],
    },
    {
      label: 'Filter',
      items: [
        { label: 'Grayscale', action: () => toggleFilter('grayscale') },
        { label: 'Sepia', action: () => toggleFilter('sepia') },
        { label: 'Invert', action: () => toggleFilter('invert') },
        { label: 'Vintage', action: () => toggleFilter('vintage') },
        { label: 'Vignette', action: () => toggleFilter('vignette') },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Zoom In', action: () => applyZoom(Math.min(10, parseFloat((zoom + 0.25).toFixed(2)))) },
        { label: 'Zoom Out', action: () => applyZoom(Math.max(0.1, parseFloat((zoom - 0.25).toFixed(2)))) },
        { label: 'Fit to Screen', action: handleFitToScreen },
        { label: '──' },
        { label: 'Layers Panel', action: () => togglePanel('layers') },
        { label: 'Adjustments Panel', action: () => togglePanel('adjustments') },
        { label: 'Histogram', action: () => togglePanel('histogram') },
        { label: 'History', action: () => togglePanel('history') },
      ],
    },
  ]

  return (
    <>
      <div style={menuBarStyle}>
        {menus.map((menu) => (
          <MenuDropdown
            key={menu.label}
            label={menu.label}
            items={menu.items}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
          />
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setShowExport(true)}
            style={{
              padding: '3px 10px', fontSize: 11, borderRadius: 3,
              background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500,
            }}
          >
            Export
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
      {showExport && (
        <ExportDialog isOpen={showExport} onClose={() => setShowExport(false)} />
      )}
      {showResize && <ResizeDialog isOpen={showResize} onClose={() => setShowResize(false)} />}
    </>
  )
}
