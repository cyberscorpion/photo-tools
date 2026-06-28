import { getFabric } from './fabricManager.ts'
import { useEditorStore } from '../store/editorStore.ts'

// Module-level clipboard — persists between operations
let _clipboard: any[] = []

/** Copy selected objects to clipboard */
export async function copySelected(): Promise<boolean> {
  const fc = getFabric()
  if (!fc) return false
  const active = fc.getActiveObjects()
  if (!active.length) return false

  _clipboard = await Promise.all(active.map((obj: any) =>
    new Promise<any>((res) => obj.clone(['customId', 'layerId']).then(res))
  ))
  return true
}

/** Cut: copy then delete selected objects */
export async function cutSelected(): Promise<boolean> {
  const fc = getFabric()
  if (!fc) return false
  const copied = await copySelected()
  if (!copied) return false
  const active = fc.getActiveObjects()
  active.forEach((obj: any) => fc.remove(obj))
  fc.discardActiveObject()
  fc.renderAll()
  useEditorStore.getState().pushHistory('Cut', fc.toJSON(['customId', 'layerId']))
  return true
}

/** Paste clipboard objects with a 20px offset */
export async function pasteClipboard(): Promise<void> {
  const fc = getFabric()
  if (!fc || !_clipboard.length) return

  // Re-clone from clipboard so paste can be called multiple times
  const clones = await Promise.all(_clipboard.map((obj: any) =>
    new Promise<any>((res) => obj.clone(['customId', 'layerId']).then(res))
  ))

  fc.discardActiveObject()
  const activeLayerId = useEditorStore.getState().activeLayerId

  clones.forEach((clone: any, i: number) => {
    // Offset each paste +20px from the original
    clone.set({
      left: (clone.left ?? 0) + 20,
      top:  (clone.top  ?? 0) + 20,
      customId: crypto.randomUUID(),
    })
    if (activeLayerId) clone.layerId = activeLayerId
    fc.add(clone)
  })

  if (clones.length === 1) {
    fc.setActiveObject(clones[0])
  } else {
    import('fabric').then(({ ActiveSelection }) => {
      const sel = new ActiveSelection(clones, { canvas: fc })
      fc.setActiveObject(sel as any)
      fc.requestRenderAll()
    })
  }

  fc.renderAll()
  useEditorStore.getState().pushHistory('Paste', fc.toJSON(['customId', 'layerId']))
}

/** Duplicate in-place: clone + offset without touching clipboard */
export async function duplicateSelected(): Promise<void> {
  const fc = getFabric()
  if (!fc) return
  const active = fc.getActiveObjects()
  if (!active.length) return

  const clones = await Promise.all(active.map((obj: any) =>
    new Promise<any>((res) => obj.clone(['customId', 'layerId']).then(res))
  ))

  fc.discardActiveObject()
  const activeLayerId = useEditorStore.getState().activeLayerId

  clones.forEach((clone: any) => {
    clone.set({
      left: (clone.left ?? 0) + 20,
      top:  (clone.top  ?? 0) + 20,
      customId: crypto.randomUUID(),
    })
    if (activeLayerId) clone.layerId = activeLayerId
    fc.add(clone)
  })

  if (clones.length === 1) {
    fc.setActiveObject(clones[0])
  } else {
    import('fabric').then(({ ActiveSelection }) => {
      const sel = new ActiveSelection(clones, { canvas: fc })
      fc.setActiveObject(sel as any)
      fc.requestRenderAll()
    })
  }

  fc.renderAll()
  useEditorStore.getState().pushHistory('Duplicate', fc.toJSON(['customId', 'layerId']))
}

export function hasClipboard(): boolean {
  return _clipboard.length > 0
}
