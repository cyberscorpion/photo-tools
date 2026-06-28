import React, { useRef, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import { getFabric } from '../../canvas/fabricManager.js'
import PanelContainer from './PanelContainer.jsx'

const CANVAS_W = 220
const CANVAS_H = 80

function drawHistogram(canvas, imageData) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  // Dark background
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  const data = imageData.data
  const rBins = new Uint32Array(256)
  const gBins = new Uint32Array(256)
  const bBins = new Uint32Array(256)

  for (let i = 0; i < data.length; i += 4) {
    rBins[data[i]]++
    gBins[data[i + 1]]++
    bBins[data[i + 2]]++
  }

  const maxVal = Math.max(
    ...rBins,
    ...gBins,
    ...bBins,
    1 // avoid division by zero
  )

  const channels = [
    { bins: rBins, color: 'rgba(255,80,80,0.7)' },
    { bins: gBins, color: 'rgba(80,255,80,0.7)' },
    { bins: bBins, color: 'rgba(80,80,255,0.7)' },
  ]

  channels.forEach(({ bins, color }) => {
    ctx.beginPath()
    ctx.moveTo(0, CANVAS_H)

    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * CANVAS_W
      const y = CANVAS_H - (bins[i] / maxVal) * CANVAS_H
      ctx.lineTo(x, y)
    }

    ctx.lineTo(CANVAS_W, CANVAS_H)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  })
}

export default function HistogramPanel() {
  const panelOpen = useEditorStore((s) => s.panels.histogram)
  const togglePanel = useEditorStore((s) => s.togglePanel)
  const adjustments = useEditorStore((s) => s.adjustments)
  const imageSize = useEditorStore((s) => s.imageSize)

  const canvasRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!panelOpen) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      const histCanvas = canvasRef.current
      if (!histCanvas) return

      const fc = getFabric()
      if (!fc) {
        // No fabric canvas — clear to placeholder
        const ctx = histCanvas.getContext('2d')
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
        ctx.fillStyle = '#555'
        ctx.font = '11px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('No canvas data', CANVAS_W / 2, CANVAS_H / 2)
        return
      }

      try {
        // fc is the Fabric Canvas instance; get the underlying lower canvas element
        const lowerCanvas = fc.lowerCanvasEl ?? fc.getElement()
        const sourceCtx = lowerCanvas.getContext('2d')
        const imgData = sourceCtx.getImageData(0, 0, lowerCanvas.width, lowerCanvas.height)
        drawHistogram(histCanvas, imgData)
      } catch (err) {
        // Cross-origin or empty canvas — show empty state
        const ctx = histCanvas.getContext('2d')
        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      }
    }, 100)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [panelOpen, adjustments, imageSize])

  return (
    <PanelContainer
      title="Histogram"
      isOpen={panelOpen}
      onToggle={() => togglePanel('histogram')}
    >
      <div
        style={{
          padding: '8px 10px',
          background: 'var(--bg-panel)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            display: 'block',
            borderRadius: '3px',
            border: '1px solid var(--border-light, #333)',
          }}
        />
      </div>
    </PanelContainer>
  )
}
