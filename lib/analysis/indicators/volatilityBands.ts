import type { Candle, Series } from '@/lib/types'
import { atr } from './atr'
import { sma } from './sma'

/** ATR as a percentage of price, so it compares across instruments. */
export function normalizedAtr(candles: Candle[], period = 14): Series {
  const range = atr(candles, period)
  return candles.map((candle, i) => {
    const value = range[i]
    return value === null || value === undefined || candle.close === 0
      ? null
      : (value / candle.close) * 100
  })
}

/** Rolling standard deviation of the close. */
export function standardDeviation(values: Series, period = 20): Series {
  const mean = sma(values, period)
  const out: Series = new Array(values.length).fill(null)
  for (let i = period - 1; i < values.length; i++) {
    const average = mean[i]
    if (average === null || average === undefined) continue
    let variance = 0
    let ok = true
    for (let offset = 0; offset < period; offset++) {
      const value = values[i - offset]
      if (value === null || value === undefined) {
        ok = false
        break
      }
      variance += (value - average) ** 2
    }
    if (ok) out[i] = Math.sqrt(variance / period)
  }
  return out
}

/** Bollinger Band width, as a fraction of the basis — the "squeeze" measure. */
export function bollingerWidth(values: Series, period = 20, stdDev = 2): Series {
  const mean = sma(values, period)
  const deviation = standardDeviation(values, period)
  return values.map((_, i) => {
    const average = mean[i]
    const sd = deviation[i]
    if (average === null || average === undefined || sd === null || sd === undefined || average === 0) {
      return null
    }
    return ((sd * stdDev * 2) / average) * 100
  })
}
