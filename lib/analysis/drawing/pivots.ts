import type { Candle } from '@/lib/types'

export type Pivot = { index: number; time: number; price: number; kind: 'high' | 'low' }

/**
 * Local extremes that dominate `window` bars on each side. Everything drawn is
 * anchored to these, so a line always sits on real turning points rather than
 * on coordinates a model guessed.
 */
export function pivotPoints(candles: Candle[], window = 3): Pivot[] {
  const out: Pivot[] = []
  for (let i = window; i < candles.length - window; i++) {
    const candle = candles[i]
    if (!candle) continue
    let isHigh = true
    let isLow = true
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue
      const other = candles[j]
      if (!other) continue
      if (other.high >= candle.high) isHigh = false
      if (other.low <= candle.low) isLow = false
    }
    if (isHigh) out.push({ index: i, time: candle.time, price: candle.high, kind: 'high' })
    if (isLow) out.push({ index: i, time: candle.time, price: candle.low, kind: 'low' })
  }
  return out
}
