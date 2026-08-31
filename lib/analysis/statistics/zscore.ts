import type { Series } from '@/lib/types'

/** Rolling z-score of a series against its own trailing window. */
export function zscore(values: Series, period = 20): Series {
  const out: Series = new Array(values.length).fill(null)
  for (let i = period - 1; i < values.length; i++) {
    const window: number[] = []
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j]
      if (v === null || v === undefined) break
      window.push(v)
    }
    if (window.length !== period) continue
    const mean = window.reduce((a, b) => a + b, 0) / period
    const sd = Math.sqrt(window.reduce((a, b) => a + (b - mean) ** 2, 0) / period)
    const cur = values[i]
    if (sd === 0 || cur === null || cur === undefined) continue
    out[i] = (cur - mean) / sd
  }
  return out
}
