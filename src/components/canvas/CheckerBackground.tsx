import React from 'react'

export default function CheckerBackground({ width, height, offsetX = 0, offsetY = 0, zoom = 1 }) {
  const tileSize = 8 / zoom
  return (
    <div
      style={{
        position: 'absolute',
        left: offsetX,
        top: offsetY,
        width: width,
        height: height,
        backgroundImage: 'repeating-conic-gradient(#cccccc 0% 25%, #ffffff 0% 50%)',
        backgroundSize: `${tileSize}px ${tileSize}px`,
        backgroundPosition: '0 0',
        pointerEvents: 'none',
      }}
    />
  )
}
