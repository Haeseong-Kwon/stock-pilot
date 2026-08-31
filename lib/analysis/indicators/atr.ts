import type { Candle, Series } from '@/lib/types'

/** True range of a bar against its predecessor. */
export function trueRange(candle: Candle, prev: Candle | undefined): number {
  if (!prev) return candle.high - candle.low
  return Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - prev.close),
    Math.abs(candle.low - prev.close),
  )
}

/** Wilder's Average True Range. */
export function atr(candles: Candle[], period = 14): Series {
  const out: Series = new Array(candles.length).fill(null)
  let sum = 0
  let prevAtr: number | null = null
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    if (!c) continue
    const tr = trueRange(c, candles[i - 1])
    if (i < period) {
      sum += tr
      if (i === period - 1) {
        prevAtr = sum / period
        out[i] = prevAtr
      }
      continue
    }
    if (prevAtr === null) continue
    prevAtr = (prevAtr * (period - 1) + tr) / period
    out[i] = prevAtr
  }
  return out
}
