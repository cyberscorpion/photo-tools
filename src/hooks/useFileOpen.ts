// Handles opening an image file into the Fabric canvas
import { useRef, useCallback } from 'react'
import { useEditorStore } from '../store/editorStore.js'
import { getFabric, initFabric, CANVAS_PAD } from '../canvas/fabricManager.js'
import { FabricImage } from 'fabric'

export function useFileOpen() {
  const fileInputRef = useRef(null)
  const { setFileName, setImageSize, setHasImage, addLayer, setActiveLayer, setShowWelcome, pushHistory } = useEditorStore()

  const openFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    // If the current tab already has an image, open in a new tab
    if (useEditorStore.getState().hasImage) {
      useEditorStore.getState().addTab()
      // Small yield so the store + canvas clear can settle
      await new Promise((r) => setTimeout(r, 20))
    }
    const dataURL = await new Promise((res) => {
      const reader = new FileReader()
      reader.onload = e => res(e.target.result)
      reader.readAsDataURL(file)
    })
    const img = new Image()
    img.onload = async () => {
      const w = img.naturalWidth, h = img.naturalHeight
      let fc = getFabric()
      if (!fc) {
        const el = document.querySelector('canvas.lower-canvas') || document.querySelector('canvas')
        if (el) fc = initFabric(el, w, h)
      }
      if (!fc) return
      fc.setWidth(w + 2 * CANVAS_PAD); fc.setHeight(h + 2 * CANVAS_PAD)
      // Reset Fabric's internal viewport to identity so getViewportPoint()
      // returns correct canvas-pixel coordinates unaffected by any stale zoom.
      fc.setViewportTransform([1, 0, 0, 1, 0, 0])
      fc.clear()
      try {
        // data: URIs do not require crossOrigin — omit to avoid unnecessary CORS implications
        // Create the layer entry FIRST so we can use its UUID on the Fabric object
        addLayer('Background')
        const newLayers = useEditorStore.getState().layers
        const bgLayerId = newLayers[newLayers.length - 1]?.id ?? 'background'

        const fabricImg = await FabricImage.fromURL(dataURL)
        // Use the layer's UUID — not the hardcoded 'background' string — so
        // layerBridge.syncLayers() can find this object and apply visibility/opacity
        fabricImg.set({ left: CANVAS_PAD, top: CANVAS_PAD, selectable: false, evented: false, layerId: bgLayerId } as any)
        fc.add(fabricImg)
        fc.renderAll()
        setFileName(file.name)
        setImageSize({ w, h })
        setHasImage(true)
        setShowWelcome(false)
        setActiveLayer(bgLayerId)
        pushHistory('Open Image', fc.toJSON(['customId','layerId']))
      } catch (err) {
        console.error('Failed to load image onto canvas:', err)
      }
    }
    img.src = dataURL
  }, [setFileName, setImageSize, setHasImage, addLayer, setActiveLayer, setShowWelcome, pushHistory])

  return { openFile, fileInputRef }
}
