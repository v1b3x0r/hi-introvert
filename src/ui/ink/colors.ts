/**
 * Map companion emotion (PAD valence/arousal) to a hex color.
 * Soft palette — never neon, never dim.
 */

export interface Emotion {
  valence: number   // -1..1
  arousal: number   // 0..1
}

const WARM = { r: 0xff, g: 0x9d, b: 0x6c }    // valence positive
const COOL = { r: 0x7d, g: 0xd3, b: 0xfc }    // valence neutral
const COLD = { r: 0x94, g: 0xa3, b: 0xb8 }    // valence negative

export function emotionToColor(e: Emotion): string {
  const v = Math.max(-1, Math.min(1, e.valence))
  let r: number, g: number, b: number
  if (v >= 0) {
    r = lerp(COOL.r, WARM.r, v)
    g = lerp(COOL.g, WARM.g, v)
    b = lerp(COOL.b, WARM.b, v)
  } else {
    const t = -v
    r = lerp(COOL.r, COLD.r, t)
    g = lerp(COOL.g, COLD.g, t)
    b = lerp(COOL.b, COLD.b, t)
  }
  return '#' + [r, g, b].map(n => Math.round(n).toString(16).padStart(2, '0')).join('')
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export const COLORS = {
  userText: '#22d3ee',     // bright cyan
  systemText: '#94a3b8',   // muted gray-blue (intentional dim)
  border: '#475569',       // medium gray
  footer: '#94a3b8',
  prompt: '#22d3ee',
  banner: ['#22d3ee', '#a855f7'] as [string, string], // cyan → magenta
}
