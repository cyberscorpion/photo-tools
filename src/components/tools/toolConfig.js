import { MousePointer2, Crop, Paintbrush, Eraser, Type, Square, Circle, Hand, ZoomIn, Pipette, Lasso } from 'lucide-react'

export default [
  { id: 'select', icon: MousePointer2, label: 'Select / Move', shortcut: 'V' },
  { id: 'crop', icon: Crop, label: 'Crop', shortcut: 'C' },
  { id: 'brush', icon: Paintbrush, label: 'Brush', shortcut: 'B' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', shortcut: 'E' },
  { id: 'text', icon: Type, label: 'Text', shortcut: 'T' },
  { id: 'rect', icon: Square, label: 'Rectangle', shortcut: 'R' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse', shortcut: 'O' },
  { id: 'hand', icon: Hand, label: 'Hand / Pan', shortcut: 'H' },
  { id: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
  { id: 'eyedropper', icon: Pipette, label: 'Eyedropper', shortcut: 'I' },
  { id: 'lasso', icon: Lasso, label: 'Lasso', shortcut: 'L' },
]
