import type { Series } from '@/lib/types'

/** Running drawdown from the all-time high seen so far, as a negative fraction. */
export function drawdown(closes: Series): Series {
  const out: Series = new Array(closes.length).fill(null)
  let peak: number | null = null
  for (let i = 0; i < closes.length; i++) {
    const v = closes[i]
    if (v === null || v === undefined) continue
    peak = peak === null ? v : Math.max(peak, v)
    out[i] = peak === 0 ? 0 : (v - peak) / peak
  }
  return out
}

export function maxDrawdown(closes: Series): number {
  const dd = drawdown(closes)
  return dd.reduce<number>((min, v) => (v === null ? min : Math.min(min, v)), 0)
}
