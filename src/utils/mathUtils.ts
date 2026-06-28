/**
 * Clamp a value between a minimum and a maximum (inclusive).
 *
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

/**
 * Linear interpolation between a and b by factor t.
 * t = 0 returns a, t = 1 returns b.
 *
 * @param {number} a  Start value.
 * @param {number} b  End value.
 * @param {number} t  Interpolation factor (typically 0–1, but not clamped).
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Convert degrees to radians.
 *
 * @param {number} deg  Angle in degrees.
 * @returns {number}    Angle in radians.
 */
export function deg2rad(deg) {
  return (deg * Math.PI) / 180
}
