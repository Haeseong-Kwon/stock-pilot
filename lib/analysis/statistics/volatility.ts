import type { Series } from '@/lib/types'
import { returns } from './returns'

/**
 * Rolling standard deviation of 1-bar returns (not annualized).
 * Used as the scale reference for "unusually large move" detection.
 */
export function volatility(closes: Series, period = 20): Series {
  const rets = returns(closes, 1)
  const out: Series = new Array(closes.length).fill(null)
  for (let i = period - 1; i < rets.length; i++) {
    const window: number[] = []
    for (let j = i - period + 1; j <= i; j++) {
      const v = rets[j]
      if (v === null || v === undefined) break
      window.push(v)
    }
    if (window.length !== period) continue
    const mean = window.reduce((a, b) => a + b, 0) / period
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / period
    out[i] = Math.sqrt(variance)
  }
  return out
}
