// ─── Canvas / Image ──────────────────────────────────────────────────────────
export interface ImageSize {
  w: number
  h: number
}

// ─── Adjustments ─────────────────────────────────────────────────────────────
export interface Adjustments {
  brightness: number
  contrast: number
  saturation: number
  hue: number
  exposure: number
  warmth: number
  tint: number
  shadows: number
  highlights: number
  sharpness: number
  blur: number
}

// ─── Layers ───────────────────────────────────────────────────────────────────
export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: string
  fabricObjectIds: string[]
  thumbnail: string | null
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export interface TabEntry {
  id: string
  name: string
  fabricJSON?: object | null
  thumbnail?: string | null
  // per-tab snapshot keys (optional — present after first switch)
  fileName?: string | null
  hasImage?: boolean
  imageSize?: ImageSize
  zoom?: number
  adjustments?: Adjustments
  activeFilters?: string[]
  layers?: Layer[]
  activeLayerId?: string | null
  history?: HistoryEntry[]
  historyIndex?: number
  cropMode?: boolean
}

// ─── History ──────────────────────────────────────────────────────────────────
export interface HistoryEntry {
  label: string
  fabricJSON: object
  timestamp: number
  canvasW?: number
  canvasH?: number
}

// ─── Selection ───────────────────────────────────────────────────────────────
export interface ActiveSelection {
  type: 'rect' | 'ellipse' | 'lasso' | 'wand'
  bounds: { x: number; y: number; w: number; h: number }
  mask?: Uint8Array | null
  /** Gaussian-feathered float mask (0.0–1.0); present when feather > 0 */
  featheredMask?: Float32Array | null
}

// ─── Tools ───────────────────────────────────────────────────────────────────
export type ToolId =
  | 'select' | 'crop' | 'brush' | 'eraser' | 'text'
  | 'rect' | 'ellipse' | 'hand' | 'zoom' | 'eyedropper' | 'lasso'
  // New tools
  | 'marquee-rect' | 'marquee-ellipse' | 'magic-wand' | 'lasso-poly'
  | 'line' | 'rounded-rect' | 'polygon'
  | 'paint-bucket' | 'gradient'
  | 'clone-stamp' | 'dodge' | 'burn' | 'blur-brush'
  | 'pen'

export interface ToolConfig {
  id: ToolId
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  shortcut: string
}

// ─── Tool Options ─────────────────────────────────────────────────────────────
export interface BrushOptions   { size: number; hardness: number; opacity: number; color: string }
export interface EraserOptions  { size: number }
export interface TextOptions    { font: string; size: number; color: string; bold: boolean; italic: boolean; underline: boolean }
export interface ShapeOptions   { fill: string; stroke: string; strokeWidth: number }

export interface ToolOptions {
  brush:   BrushOptions
  eraser:  EraserOptions
  text:    TextOptions
  rect:    ShapeOptions
  ellipse: ShapeOptions
  // new tool options (added incrementally)
  [key: string]: unknown
}

// ─── Store Actions subset (for passing into toolHandlers) ─────────────────────
export interface StoreActions {
  setForegroundColor: (hex: string) => void
  setActiveSelection?: (sel: ActiveSelection | null) => void
  clearSelection?: () => void
  pushHistory?: (label: string, json: object) => void
}
