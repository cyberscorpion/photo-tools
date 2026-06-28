import React from 'react'

export default function CheckerBackground({ width, height }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: width,
        height: height,
        backgroundImage: 'repeating-conic-gradient(#404040 0% 25%, #333333 0% 50%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0',
        pointerEvents: 'none',
      }}
    />
  )
}
