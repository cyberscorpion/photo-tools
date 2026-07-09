import React from 'react'

export default function CheckerBackground({ width, height }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: width,
        height: height,
        backgroundImage: 'repeating-conic-gradient(#cccccc 0% 25%, #ffffff 0% 50%)',
        backgroundSize: '8px 8px',
        backgroundPosition: '0 0',
        pointerEvents: 'none',
      }}
    />
  )
}
