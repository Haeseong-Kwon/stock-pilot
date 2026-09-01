import type { Candle } from '@/lib/types'

export type SymbolStats = {
  last: number
  change: number
  changePercent: number
  dayHigh: number
  dayLow: number
  periodHigh: number
  periodLow: number
  /** Where the last price sits between the period low and high, 0..1. */
  periodPosition: number
  volume: number
  averageVolume: number
  volumeRatio: number
}

/**
 * The header numbers every terminal shows. `lookback` is the window for the
 * "52-week" style range — in bars, because the timeframe varies.
 */
export function symbolStats(candles: Candle[], lookback = 252): SymbolStats | null {
  const last = candles[candles.length - 1]
  const previous = candles[candles.length - 2]
  if (!last) return null

  const window = candles.slice(-lookback)
  let periodHigh = -Infinity
  let periodLow = Infinity
  let volumeSum = 0
  for (const candle of window) {
    periodHigh = Math.max(periodHigh, candle.high)
    periodLow = Math.min(periodLow, candle.low)
    volumeSum += candle.volume
  }

  const change = previous ? last.close - previous.close : 0
  const span = periodHigh - periodLow
  const averageVolume = window.length > 0 ? volumeSum / window.length : 0

  return {
    last: last.close,
    change,
    changePercent: previous && previous.close !== 0 ? change / previous.close : 0,
    dayHigh: last.high,
    dayLow: last.low,
    periodHigh,
    periodLow,
    periodPosition: span > 0 ? (last.close - periodLow) / span : 0.5,
    volume: last.volume,
    averageVolume,
    volumeRatio: averageVolume > 0 ? last.volume / averageVolume : 0,
  }
}
