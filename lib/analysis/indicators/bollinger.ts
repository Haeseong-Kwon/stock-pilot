import type { Series } from '@/lib/types'
import { sma } from './sma'

export type BollingerResult = { upper: Series; middle: Series; lower: Series }

export function bollinger(closes: Series, period = 20, stdDev = 2): BollingerResult {
  const middle = sma(closes, period)
  const upper: Series = new Array(closes.length).fill(null)
  const lower: Series = new Array(closes.length).fill(null)
  for (let i = 0; i < closes.length; i++) {
    const mean = middle[i]
    if (mean === null || mean === undefined) continue
    let variance = 0
    let ok = true
    for (let j = i - period + 1; j <= i; j++) {
      const v = closes[j]
      if (v === null || v === undefined) {
        ok = false
        break
      }
      variance += (v - mean) ** 2
    }
    if (!ok) continue
    const sd = Math.sqrt(variance / period)
    upper[i] = mean + sd * stdDev
    lower[i] = mean - sd * stdDev
  }
  return { upper, middle, lower }
}
