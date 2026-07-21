# Copilot Instructions — photo-tools

Browser-based Photoshop-style image editor. Pure frontend (React 18 + Vite 5 + TypeScript + Fabric.js 6 + Zustand 5). No server, no backend. Deploys to GitHub Pages from `main`.

## Commands

```bash
npm install
npm run dev        # Vite dev server at http://localhost:5173/photo-tools/
npm run build      # Type-check-less build via Vite; outputs dist/
npm run preview    # Serve built dist/ locally
```

There is no test runner and no lint script configured — do not invent one. Do not run `tsc` as a validation step; `tsconfig.json` sets `noEmit: true`, `strict: false`, `allowJs: true`. Validation is `npm run build`.

Deploy is automatic on push to `main` via `.github/workflows/deploy.yml` (GitHub Pages, `base: '/photo-tools/'`). Do not change `base` in `vite.config.ts` unless the deploy target changes.

## Architecture — the parts you must know before editing

The code is split into three cooperating layers. Skimming any single file will mislead you; the contracts below are enforced across files.

### 1. Fabric.js canvas singleton (`src/canvas/`)
- `fabricManager.ts` owns the **single** `fabric.Canvas` instance. Get it via `getFabric()`; never construct `new Canvas(...)` elsewhere. `initFabric()` is called only from `CanvasStage`.
- The DOM canvas is padded by `CANVAS_PAD = 400` px on every side so Fabric selection handles can render outside the image bounds. `WorkspaceArea` applies a matching negative CSS offset — keep the two in sync if you touch either.
- `toolHandlers.ts` (~2300 lines) is the dispatcher for every drawing/selection/pixel tool. Adding a tool means: register handler here, add entry in `src/components/tools/toolConfig.ts`, add shortcut in `hooks/useKeyboardShortcuts.ts`, and (if it has options) surface controls in `layout/OptionsBar.tsx`.
- `adjustmentEngine.ts` and `filterPresets.ts` apply **non-destructive** Fabric filters — they mutate `image.filters` and call `applyFilters()`, they must not bake pixels into the source.
- `contourEngine.ts` uses an exact Euclidean Distance Transform for the sticker-outline feature; the math is load-bearing, don't "simplify" it.

### 2. Zustand store with per-tab snapshots (`src/store/editorStore.ts`)
- One global store, but state is **partitioned per tab**. The list of per-tab keys is `PER_TAB_STATE_KEYS` — if you add a new stateful concept that belongs to a document (adjustments, layers, history, zoom, etc.), add its key to that array or it will leak between tabs.
- On tab switch, `captureTabSnapshot` serializes the current Fabric canvas to JSON (`fc.toJSON(['customId','layerId'])`) into the outgoing tab, then `loadTabSnapshot` + `reloadCanvas` rehydrates the incoming tab. Preserve the `customId` and `layerId` custom Fabric properties in any `toJSON`/`loadFromJSON` call you write.
- History is a 50-state (`MAX_HISTORY`) ring buffer of Fabric JSON snapshots per tab. Push history via the store's history helpers, not by manipulating the array directly. Wrap internal canvas mutations that shouldn't create history entries with `setSuppressHistoryBridge(true/false)` (see `fabricManager.ts`) to silence the `object:modified` / `path:created` bridge.

### 3. React shell (`src/components/`)
- `layout/AppShell.tsx` is the frame: `MenuBar`, `ToolBar` (left), `OptionsBar` (contextual, per active tool), `WorkspaceArea` (hosts `CanvasStage`), right-side `PanelContainer` (Adjustments / Layers / History / Histogram / Contour), `StatusBar`, `TabBar`.
- Panels are dumb views over the store; they must not talk to Fabric directly — go through store actions or `src/canvas/*` helpers.
- Zoom is CSS-transform based (not Fabric zoom) — see `hooks/useZoom.ts` and `WorkspaceArea`. Pan is native scroll on the workspace container.

## Conventions specific to this codebase

- **Imports use `.js` / `.jsx` extensions for `.ts` / `.tsx` source files** (e.g., `import App from './App.jsx'`). This is required by `tsconfig`'s `moduleResolution: "bundler"` + `allowImportingTsExtensions`. Match the existing style; don't rewrite them to extensionless.
- The store file is `.ts` but is written in plain JS (no annotations, uses `crypto.randomUUID()` freely). Adjustments/layers/history helpers there are untyped by design; keep new store code in the same style rather than partially typing it.
- Fabric objects carry two custom properties, `customId` and `layerId`. When creating objects programmatically, assign both so serialization round-trips through tab-switch/undo work correctly.
- Layer membership is tracked by `layerId` on Fabric objects **and** by `fabricObjectIds: []` on the layer record — both must stay in sync (see `layerBridge.ts`).
- Modifier-key semantics are Photoshop-compatible and documented in `README.md` — preserve them when editing tool handlers (Shift = constrain/straight-line, Alt = from-center / temporary eyedropper / invert dodge↔burn, Space = temporary Hand).
- Vite `manualChunks` split (`vendor`, `fabric`, `zustand`) is intentional for GitHub Pages load performance — don't collapse it.
- The project is **proprietary** (see `LICENSE`), not open-source despite being on GitHub. Don't add OSS-style contribution boilerplate.
