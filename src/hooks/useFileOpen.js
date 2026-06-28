// Handles opening an image file into the Fabric canvas
import { useRef, useCallback } from 'react'
import { useEditorStore } from '../store/editorStore.js'
import { getFabric, initFabric } from '../canvas/fabricManager.js'
import { FabricImage } from 'fabric'

export function useFileOpen() {
  const fileInputRef = useRef(null)
  const { setFileName, setImageSize, setHasImage, addLayer, setActiveLayer, setShowWelcome, pushHistory } = useEditorStore()

  const openFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return
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
      fc.setWidth(w); fc.setHeight(h)
      fc.clear()
      try {
        // data: URIs do not require crossOrigin — omit to avoid unnecessary CORS implications
        const fabricImg = await FabricImage.fromURL(dataURL)
        fabricImg.set({ left: 0, top: 0, selectable: false, evented: false, layerId: 'background' })
        fc.add(fabricImg)
        fc.renderAll()
        setFileName(file.name)
        setImageSize({ w, h })
        setHasImage(true)
        setShowWelcome(false)
        addLayer('Background')
        const layers = useEditorStore.getState().layers
        // Select the most recently added layer (last in array)
        if (layers.length) setActiveLayer(layers[layers.length - 1].id)
        pushHistory('Open Image', fc.toJSON(['customId','layerId']))
      } catch (err) {
        console.error('Failed to load image onto canvas:', err)
      }
    }
    img.src = dataURL
  }, [setFileName, setImageSize, setHasImage, addLayer, setActiveLayer, setShowWelcome, pushHistory])

  return { openFile, fileInputRef }
}
