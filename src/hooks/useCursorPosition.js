import { useState, useCallback } from 'react'

export function useCursorPosition() {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setPos({ x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) })
  }, [])
  return { pos, handleMouseMove }
}
