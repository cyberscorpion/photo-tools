# Photo Tools — Free Browser-Based Photo Editor

**A Photoshop-style image editing web application that runs entirely in your browser — no installation, no account, no backend.**

🔗 **Live App:** [https://cyberscorpion.github.io/photo-tools](https://cyberscorpion.github.io/photo-tools)

---

## What is Photo Tools?

Photo Tools is a free, open-source photo editing application that works directly in modern web browsers. It provides a Photoshop-like editing experience with a professional dark interface, multi-tab document support, non-destructive adjustments, a full selection toolkit, shape drawing, pixel-level retouching, and a Fabric.js-powered canvas — all without installing any software.

If you are looking for a **free online alternative to Photoshop**, a **browser-based image editor**, or a **lightweight Photopea alternative**, Photo Tools is built for you.

---

## Key Features

### 🖼️ Multi-Tab Document Editor
- Open multiple images simultaneously, each in its own sandboxed tab
- Per-tab zoom, undo history, adjustments, layers, and canvas state
- Switch tabs without losing work — canvas state is serialized and restored

### 🛠️ Complete Tool Suite (25+ Tools)

**Selection Tools**
| Tool | Shortcut | Description |
|------|----------|-------------|
| Select / Move | `V` | Select and reposition canvas objects |
| Rectangular Marquee | `M` | Draw rectangular pixel selections |
| Elliptical Marquee | `M` | Draw elliptical / circular selections |
| Magic Wand | `W` | Click-to-select areas by color tolerance |
| Lasso | `L` | Freehand selection |
| Polygonal Lasso | `L` | Click-to-add-points selection path |

**Drawing & Painting Tools**
| Tool | Shortcut | Description |
|------|----------|-------------|
| Brush | `B` | Freehand painting with size, opacity, color controls |
| Eraser | `E` | Pixel-level erasing (destination-out compositing) |
| Clone Stamp | `S` | Sample a source area, paint it elsewhere |
| Dodge | `O` | Lighten pixels by painting over them |
| Burn | `O` | Darken pixels by painting over them |
| Blur Brush | — | Locally blur pixels while painting |

**Shape Tools**
| Tool | Shortcut | Description |
|------|----------|-------------|
| Rectangle | `R` | Draw rectangles (Shift = square, Alt = from center) |
| Ellipse | `O` | Draw ellipses / circles |
| Rounded Rectangle | `U` | Configurable corner radius |
| Polygon | `U` | Regular polygons with 3–12 sides |
| Line | `U` | Straight lines with 45° Shift-snap |
| Pen | `P` | Bezier anchor-point path drawing |

**Fill & Gradient Tools**
| Tool | Shortcut | Description |
|------|----------|-------------|
| Paint Bucket | `G` | Flood-fill by color tolerance |
| Gradient | `G` | Linear or radial gradient fill |

**Other Tools**
| Tool | Shortcut | Description |
|------|----------|-------------|
| Text | `T` | Editable text with system font selection |
| Crop | `C` | Interactive crop with resize handles and dark overlay |
| Eyedropper | `I` | Sample any color from the canvas |
| Hand / Pan | `H` | Pan the canvas viewport |
| Zoom | `Z` | Zoom in / out |

---

### 🎨 Non-Destructive Image Adjustments

All sliders apply in real-time without permanently altering the original pixels:

| Adjustment | Range | Effect |
|---|---|---|
| Brightness | −100 → +100 | Lightens or darkens the entire image |
| Contrast | −100 → +100 | Increases or reduces tonal range |
| Saturation | −100 → +100 | Boosts or desaturates colors |
| Hue Rotation | −180° → +180° | Shifts all hues around the color wheel |
| Exposure | −50 → +50 | Applies a gamma curve (like camera EV) |
| Warmth | −100 → +100 | Shifts color temperature warm/cool |
| Tint | −100 → +100 | Green/magenta balance |
| Shadows | −100 → +100 | Lifts or crushes dark tones |
| Highlights | −100 → +100 | Recovers or reduces bright tones |
| Sharpness | 0 → 100 | Unsharp mask |
| Blur | 0 → 100 | Gaussian blur |

---

### 🎞️ Filters

One-click named filter presets:

- **Grayscale** — Converts to black and white
- **Sepia** — Warm vintage brown tone
- **Invert** — Negative / inverted colors
- **Vintage** — Faded analog film look
- **Vignette** — Dark edges, bright center

---

### 🗂️ Layers System

- Add, delete, duplicate, and reorder layers
- Toggle visibility (eye icon)
- Per-layer opacity slider
- Blend modes: Normal, Multiply, Screen, Overlay, Soft Light, Hard Light, Difference
- **Import as Layer** — Add any image file as a new layer on top of the current canvas

---

### ✂️ Contour / Outline Generator

A unique feature for sticker design and cut-file generation:

- Generate a smooth contour outline around any PNG subject
- **Offset** — gap between the image edge and where the contour starts
- **Thickness** — width of the contour band
- **Corner Radius** — rounds sharp corners into smooth arcs
- Export contour separately as **PNG** (transparent background) or **SVG path**

---

### ↩️ History & Undo

- 50-state undo/redo ring buffer (Ctrl+Z / Ctrl+Y)
- History panel with named states and one-click jump
- All operations tracked: brush strokes, shape drawing, crop, adjustments, filters, layer changes

---

### 📤 Export Options

- Export as **PNG**, **JPEG** (with quality slider), or **WebP**
- Copy canvas to **clipboard** as PNG
- Per-tab export — each tab exports its own content

---

## Modifier Keys (Photoshop-compatible)

| Tool | Shift | Alt |
|---|---|---|
| Zoom | Zoom out (cursor updates live) | Zoom out |
| Brush | Click-to-click straight line | Temporary eyedropper (sample color) |
| Rect / Ellipse | Constrain to square / circle | Draw from center |
| Dodge | Double exposure | Temporarily acts as Burn |
| Burn | Double exposure | Temporarily acts as Dodge |
| Blur Brush | Sharpen mode | Sharpen mode |
| Clone Stamp | — | Set sample source point |

---

## Keyboard Shortcuts

### Tools
| Key | Tool |
|---|---|
| `V` | Select / Move |
| `M` | Rectangular Marquee |
| `W` | Magic Wand |
| `C` | Crop |
| `B` | Brush |
| `E` | Eraser |
| `T` | Text |
| `R` | Rectangle |
| `O` | Ellipse / Dodge / Burn |
| `U` | Line / Rounded Rect / Polygon |
| `G` | Paint Bucket / Gradient |
| `H` | Hand / Pan |
| `Z` | Zoom |
| `I` | Eyedropper |
| `L` | Lasso / Polygonal Lasso |
| `S` | Clone Stamp |
| `P` | Pen |

### Actions
| Shortcut | Action |
|---|---|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` | Copy selected |
| `Ctrl+X` | Cut selected |
| `Ctrl+V` | Paste |
| `Ctrl+D` | Duplicate (in-place +20px) |
| `Ctrl+A` | Select all |
| `Ctrl+G` | Group selected objects |
| `Ctrl+Shift+E` | Flatten visible layers |
| `Ctrl+Shift+N` | New layer |
| `Ctrl+T` | Free transform (Fabric handles on selected object) |
| `Ctrl+S` | Open Export dialog |
| `Ctrl+T` | New tab |
| `Delete` | Delete selected objects |
| `Alt+Delete` | Fill with foreground color |
| `Ctrl+Backspace` | Fill with background color |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | 100% zoom |
| `F` | Fit to screen |
| `Space` | Temporary Hand tool (hold) |
| `[` / `]` | Decrease / increase brush size by 5px |
| `Tab` | Toggle all panels |
| `Escape` | Cancel crop / deselect |
| `Enter` | Confirm crop |

---

## Getting Started

### Run Locally

```bash
# Clone the repository
git clone https://github.com/cyberscorpion/photo-tools.git
cd photo-tools

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173/photo-tools/](http://localhost:5173/photo-tools/) in your browser.

### Build for Production

```bash
npm run build      # Outputs to dist/
npm run preview    # Serve dist/ locally to test
```

---

## Deployment

The app deploys automatically to **GitHub Pages** on every push to `main` via GitHub Actions.

**Manual setup (one-time):**
1. Go to your repository → **Settings** → **Pages**
2. Set Source to **GitHub Actions**
3. Push to `main` — the workflow handles the rest

Live at: `https://<your-username>.github.io/photo-tools/`

---

## Tech Stack

| Package | Version | Role |
|---|---|---|
| [React](https://react.dev) | 18 | UI framework |
| [Vite](https://vitejs.dev) | 5 | Build tool & dev server |
| [TypeScript](https://www.typescriptlang.org) | 5 | Type safety |
| [Fabric.js](http://fabricjs.com) | 6 | Canvas object model & rendering |
| [Zustand](https://zustand-demo.pmnd.rs) | 5 | Global state management |
| [Lucide React](https://lucide.dev) | — | Icon library |

**Architecture highlights:**
- Pure frontend — zero server, zero database, zero login
- CSS transform-based zoom with full scroll-to-anywhere pan
- Exact Euclidean Distance Transform for pixel-perfect contour generation
- Fabric.js canvas serialization (JSON) for per-tab undo/redo and tab-switching
- TypeScript with `strict: false` baseline, incrementally tightenable

---

## Browser Support

Photo Tools requires a modern browser with Canvas 2D API, CSS transforms, and ES2020 support.

| Browser | Minimum Version |
|---|---|
| Chrome / Edge | 103+ (Local Font Access API for system fonts) |
| Firefox | 105+ |
| Safari | 16+ |

---

## License

**Proprietary — All Rights Reserved.**

Copyright © 2025 Rajat Jain. This software is proprietary and confidential. No part of this software may be reproduced, distributed, modified, or used without prior written permission from the copyright owner.

See [LICENSE](LICENSE) for full terms.

---

## Related Projects & Comparisons

Photo Tools is inspired by and comparable to:

- **Adobe Photoshop** — the industry standard desktop photo editor
- **Photopea** — a free online Photoshop alternative
- **GIMP** — an open-source desktop image editor
- **Figma** — vector-focused design tool with raster capabilities
- **Canva** — simplified graphic design for non-designers

Unlike cloud-based editors, Photo Tools processes everything **locally in your browser** — your images never leave your device.

---

*Built by Rajat Jain, with ❤️ using React, Vite, TypeScript, and Fabric.js*
