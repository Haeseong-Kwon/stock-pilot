import type { Series } from '@/lib/types'

/** Exponential moving average, seeded with the SMA of the first `period` values. */
export function ema(values: Series, period: number): Series {
  if (period <= 0) throw new Error('ema: period must be > 0')
  const out: Series = new Array(values.length).fill(null)
  const k = 2 / (period + 1)
  let seed = 0
  let count = 0
  let prev: number | null = null
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v === null || v === undefined) continue
    if (prev === null) {
      seed += v
      count++
      if (count === period) {
        prev = seed / period
        out[i] = prev
      }
      continue
    }
    prev = v * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}
