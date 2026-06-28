import { create } from 'zustand'
import { getFabric } from '../canvas/fabricManager.js'

const MAX_HISTORY = 50

const makeLayer = (name) => ({
  id: crypto.randomUUID(),
  name,
  visible: true,
  locked: false,
  opacity: 1,
  blendMode: 'normal',
  fabricObjectIds: [],
  thumbnail: null,
})

const initialAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  exposure: 0,
  warmth: 0,
  tint: 0,
  shadows: 0,
  highlights: 0,
  sharpness: 0,
  blur: 0,
}

const _initialTabId = crypto.randomUUID()

const PER_TAB_STATE_KEYS = [
  'fileName','hasImage','imageSize','zoom','adjustments',
  'activeFilters','layers','activeLayerId','history','historyIndex','cropMode',
]

function captureTabSnapshot(state) {
  const fc = getFabric()
  const snap = {}
  PER_TAB_STATE_KEYS.forEach((k) => { snap[k] = state[k] })
  snap.fabricJSON = fc ? fc.toJSON(['customId','layerId']) : null
  return snap
}

function loadTabSnapshot(snap, tabs, newActiveId) {
  const fc = getFabric()
  const flatState = { activeTabId: newActiveId, tabs }
  PER_TAB_STATE_KEYS.forEach((k) => {
    flatState[k] = snap[k] !== undefined ? snap[k] : getDefaultForKey(k)
  })
  flatState.showWelcome = !(snap.hasImage ?? false)
  flatState.cropMode = false
  return flatState
}

function getDefaultForKey(key) {
  const defaults = {
    fileName: null, hasImage: false, imageSize: { w: 0, h: 0 }, zoom: 1.0,
    adjustments: { brightness:0,contrast:0,saturation:0,hue:0,exposure:0,warmth:0,tint:0,shadows:0,highlights:0,sharpness:0,blur:0 },
    activeFilters: [], layers: [], activeLayerId: null,
    history: [], historyIndex: -1, cropMode: false,
  }
  return defaults[key]
}

function reloadCanvas(snap) {
  const fc = getFabric()
  if (!fc) return
  fc.clear()
  const w = snap.imageSize?.w || 800
  const h = snap.imageSize?.h || 600
  fc.setWidth(w)
  fc.setHeight(h)
  if (snap.fabricJSON) {
    fc.loadFromJSON(snap.fabricJSON).then(() => fc.renderAll()).catch(() => {})
  } else {
    fc.renderAll()
  }
}

export const useEditorStore = create((set, get) => ({
  // ── File / canvas meta ──────────────────────────────────────────────────────
  fileName: null,
  imageSize: { w: 0, h: 0 },
  hasImage: false,
  zoom: 1.0,
  panOffset: { x: 0, y: 0 },

  // ── Tools ───────────────────────────────────────────────────────────────────
  activeTool: 'select',
  toolOptions: {
    brush: { size: 12, hardness: 80, opacity: 100, color: '#000000' },
    eraser: { size: 20 },
    text: { font: 'Arial', size: 24, color: '#000000', bold: false, italic: false },
    rect: { fill: '#ff0000', stroke: 'transparent', strokeWidth: 0 },
    ellipse: { fill: '#0000ff', stroke: 'transparent', strokeWidth: 0 },
  },

  // ── Colors ──────────────────────────────────────────────────────────────────
  foregroundColor: '#000000',
  backgroundColor: '#ffffff',

  // ── Layers ──────────────────────────────────────────────────────────────────
  layers: [],
  activeLayerId: null,

  // ── Adjustments ─────────────────────────────────────────────────────────────
  adjustments: { ...initialAdjustments },

  // ── Filters ─────────────────────────────────────────────────────────────────
  activeFilters: [],

  // ── History ─────────────────────────────────────────────────────────────────
  history: [],
  historyIndex: -1,

  // ── Selection ───────────────────────────────────────────────────────────────
  selection: null,

  // ── UI panels ───────────────────────────────────────────────────────────────
  panels: { layers: true, adjustments: true, histogram: false, history: false, contour: true },

  // ── Welcome screen ──────────────────────────────────────────────────────────
  showWelcome: true,
  cropMode: false,

  // ── Tabs ────────────────────────────────────────────────────────────────────
  tabs: [{ id: _initialTabId, name: 'Untitled' }],
  activeTabId: _initialTabId,

  // ── Actions ─────────────────────────────────────────────────────────────────

  setActiveTool: (id) => set({ activeTool: id }),

  setToolOption: (tool, key, value) =>
    set((s) => ({
      toolOptions: {
        ...s.toolOptions,
        [tool]: { ...s.toolOptions[tool], [key]: value },
      },
    })),

  setForegroundColor: (hex) => set({ foregroundColor: hex }),
  setBackgroundColor: (hex) => set({ backgroundColor: hex }),

  setZoom: (level) => set({ zoom: level }),
  setPanOffset: ({ x, y }) => set({ panOffset: { x, y } }),

  setFileName: (name) =>
    set((s) => ({
      fileName: name,
      tabs: s.tabs.map((t) =>
        t.id === s.activeTabId ? { ...t, name: name || 'Untitled' } : t
      ),
    })),
  setImageSize: ({ w, h }) => set({ imageSize: { w, h } }),
  setShowWelcome: (bool) => set({ showWelcome: bool }),
  setHasImage: (bool) => set({ hasImage: bool }),

  // ── Layer actions ────────────────────────────────────────────────────────────

  addLayer: (name) =>
    set((s) => {
      const layer = makeLayer(name)
      return {
        layers: [...s.layers, layer],
        activeLayerId: layer.id,
      }
    }),

  removeLayer: (id) =>
    set((s) => {
      const layers = s.layers.filter((l) => l.id !== id)
      const activeLayerId =
        s.activeLayerId === id
          ? layers.length > 0
            ? layers[layers.length - 1].id
            : null
          : s.activeLayerId
      return { layers, activeLayerId }
    }),

  duplicateLayer: (id) =>
    set((s) => {
      const original = s.layers.find((l) => l.id === id)
      if (!original) return {}
      const copy = {
        ...original,
        id: crypto.randomUUID(),
        name: original.name + ' copy',
        fabricObjectIds: [...original.fabricObjectIds],
      }
      const idx = s.layers.findIndex((l) => l.id === id)
      const layers = [
        ...s.layers.slice(0, idx + 1),
        copy,
        ...s.layers.slice(idx + 1),
      ]
      return { layers, activeLayerId: copy.id }
    }),

  toggleLayerVisibility: (id) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l
      ),
    })),

  setLayerOpacity: (id, opacity) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l
      ),
    })),

  setLayerBlendMode: (id, mode) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? { ...l, blendMode: mode } : l
      ),
    })),

  setActiveLayer: (id) => set({ activeLayerId: id }),

  reorderLayers: (fromIdx, toIdx) =>
    set((s) => {
      const layers = [...s.layers]
      const [moved] = layers.splice(fromIdx, 1)
      layers.splice(toIdx, 0, moved)
      return { layers }
    }),

  renameLayer: (id, name) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? { ...l, name } : l
      ),
    })),

  updateLayerThumbnail: (id, dataURL) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? { ...l, thumbnail: dataURL } : l
      ),
    })),

  // ── Adjustment actions ───────────────────────────────────────────────────────

  setAdjustment: (key, value) =>
    set((s) => ({
      adjustments: { ...s.adjustments, [key]: value },
    })),

  resetAdjustments: () => set({ adjustments: { ...initialAdjustments } }),

  // ── Filter actions ───────────────────────────────────────────────────────────

  toggleFilter: (name) =>
    set((s) => {
      const active = s.activeFilters.includes(name)
      return {
        activeFilters: active
          ? s.activeFilters.filter((f) => f !== name)
          : [...s.activeFilters, name],
      }
    }),

  // ── History actions ──────────────────────────────────────────────────────────

  pushHistory: (label, fabricJSON) =>
    set((s) => {
      // Discard any "forward" history beyond current index
      const truncated = s.history.slice(0, s.historyIndex + 1)
      const { imageSize: _sz } = get()
      const entry = { label, fabricJSON, timestamp: Date.now(), canvasW: _sz.w, canvasH: _sz.h }
      const next = [...truncated, entry]

      // Ring buffer: keep at most MAX_HISTORY entries
      if (next.length > MAX_HISTORY) {
        next.splice(0, next.length - MAX_HISTORY)
      }

      return {
        history: next,
        historyIndex: next.length - 1,
      }
    }),

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex <= 0) return null
    const newIndex = historyIndex - 1
    set({ historyIndex: newIndex })
    const entry = history[newIndex]
    if (entry?.canvasW && entry?.canvasH) {
      const _fc = getFabric()
      if (_fc) { _fc.setWidth(entry.canvasW); _fc.setHeight(entry.canvasH) }
      set({ imageSize: { w: entry.canvasW, h: entry.canvasH } })
    }
    // Restore canvas state from the history entry
    if (entry?.fabricJSON) {
      const fc = getFabric()
      if (fc) {
        fc.loadFromJSON(entry.fabricJSON).then(() => fc.renderAll())
      }
    }
    return entry
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return null
    const newIndex = historyIndex + 1
    set({ historyIndex: newIndex })
    const entry = history[newIndex]
    if (entry?.canvasW && entry?.canvasH) {
      const _fc = getFabric()
      if (_fc) { _fc.setWidth(entry.canvasW); _fc.setHeight(entry.canvasH) }
      set({ imageSize: { w: entry.canvasW, h: entry.canvasH } })
    }
    // Restore canvas state from the history entry
    if (entry?.fabricJSON) {
      const fc = getFabric()
      if (fc) {
        fc.loadFromJSON(entry.fabricJSON).then(() => fc.renderAll())
      }
    }
    return entry
  },

  jumpToHistory: (idx) => {
    const { history } = get()
    if (idx < 0 || idx >= history.length) return null
    set({ historyIndex: idx })
    const entry = history[idx]
    if (entry?.canvasW && entry?.canvasH) {
      const _fc = getFabric()
      if (_fc) { _fc.setWidth(entry.canvasW); _fc.setHeight(entry.canvasH) }
      set({ imageSize: { w: entry.canvasW, h: entry.canvasH } })
    }
    // Restore canvas state from the history entry
    if (entry?.fabricJSON) {
      const fc = getFabric()
      if (fc) {
        fc.loadFromJSON(entry.fabricJSON).then(() => fc.renderAll())
      }
    }
    return entry
  },

  // ── Panel actions ────────────────────────────────────────────────────────────

  togglePanel: (name) =>
    set((s) => ({
      panels: { ...s.panels, [name]: !s.panels[name] },
    })),

  // ── File open ────────────────────────────────────────────────────────────────

  openFile: (file) =>
    set({
      showWelcome: false,
      fileName: file?.name ?? null,
      hasImage: true,
    }),

  setCropMode: (bool) => set({ cropMode: bool }),

  // ── Tab actions ──────────────────────────────────────────────────────────────

  addTab: () =>
    set((s) => {
      const snap = captureTabSnapshot(s)
      const newId = crypto.randomUUID()
      const updatedTabs = [
        ...s.tabs.map((t) => (t.id === s.activeTabId ? { ...t, ...snap } : t)),
        { id: newId, name: 'Untitled' },
      ]
      const fc = getFabric()
      if (fc) {
        fc.clear()
        fc.setWidth(800)
        fc.setHeight(600)
        fc.renderAll()
      }
      return {
        activeTabId: newId,
        tabs: updatedTabs,
        fileName: null,
        hasImage: false,
        imageSize: { w: 0, h: 0 },
        zoom: 1.0,
        adjustments: getDefaultForKey('adjustments'),
        activeFilters: [],
        layers: [],
        activeLayerId: null,
        history: [],
        historyIndex: -1,
        cropMode: false,
        showWelcome: true,
      }
    }),

  switchTab: (id) => {
    const state = get()
    if (id === state.activeTabId) return
    const snap = captureTabSnapshot(state)
    const updatedTabs = state.tabs.map((t) =>
      t.id === state.activeTabId ? { ...t, ...snap } : t
    )
    const targetTab = updatedTabs.find((t) => t.id === id)
    if (!targetTab) return
    const flatState = loadTabSnapshot(targetTab, updatedTabs, id)
    set(flatState)
    reloadCanvas(targetTab)
  },

  closeTab: (id) => {
    const state = get()
    const newTabs = state.tabs.filter((t) => t.id !== id)
    if (newTabs.length === 0) {
      const freshId = crypto.randomUUID()
      newTabs.push({ id: freshId, name: 'Untitled' })
    }
    if (id !== state.activeTabId) {
      set({ tabs: newTabs })
      return
    }
    const closedIdx = state.tabs.findIndex((t) => t.id === id)
    const nextTab = newTabs[Math.max(0, closedIdx - 1)] || newTabs[0]
    const flatState = loadTabSnapshot(nextTab, newTabs, nextTab.id)
    set(flatState)
    reloadCanvas(nextTab)
  },

  renameTab: (id, name) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, name } : t)),
    })),
}))
