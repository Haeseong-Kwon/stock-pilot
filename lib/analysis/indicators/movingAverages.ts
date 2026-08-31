import type { Candle, Series } from '@/lib/types'
import { ema } from './ema'
import { sma } from './sma'

/** Linearly weighted moving average — the newest bar carries the most weight. */
export function wma(values: Series, period: number): Series {
  if (period <= 0) throw new Error('wma: period must be > 0')
  const out: Series = new Array(values.length).fill(null)
  const denominator = (period * (period + 1)) / 2

  for (let i = period - 1; i < values.length; i++) {
    let weighted = 0
    let ok = true
    for (let offset = 0; offset < period; offset++) {
      const value = values[i - offset]
      if (value === null || value === undefined) {
        ok = false
        break
      }
      weighted += value * (period - offset)
    }
    if (ok) out[i] = weighted / denominator
  }
  return out
}

/** Hull moving average: WMA(2·WMA(n/2) − WMA(n), √n). Fast and smooth. */
export function hma(values: Series, period: number): Series {
  if (period <= 1) throw new Error('hma: period must be > 1')
  const half = wma(values, Math.max(1, Math.round(period / 2)))
  const full = wma(values, period)
  const diff: Series = values.map((_, i) => {
    const h = half[i]
    const f = full[i]
    return h === null || h === undefined || f === null || f === undefined ? null : 2 * h - f
  })
  return wma(diff, Math.max(1, Math.round(Math.sqrt(period))))
}

/** Double EMA — 2·EMA − EMA(EMA); less lag than a plain EMA. */
export function dema(values: Series, period: number): Series {
  const first = ema(values, period)
  const second = ema(first, period)
  return values.map((_, i) => {
    const a = first[i]
    const b = second[i]
    return a === null || a === undefined || b === null || b === undefined ? null : 2 * a - b
  })
}

/** Triple EMA — 3·EMA − 3·EMA² + EMA³. */
export function tema(values: Series, period: number): Series {
  const first = ema(values, period)
  const second = ema(first, period)
  const third = ema(second, period)
  return values.map((_, i) => {
    const a = first[i]
    const b = second[i]
    const c = third[i]
    if (a === null || a === undefined || b === null || b === undefined || c === null || c === undefined) {
      return null
    }
    return 3 * a - 3 * b + c
  })
}

/** Volume-weighted moving average. */
export function vwma(candles: Candle[], period: number): Series {
  if (period <= 0) throw new Error('vwma: period must be > 0')
  const out: Series = new Array(candles.length).fill(null)
  for (let i = period - 1; i < candles.length; i++) {
    let numerator = 0
    let denominator = 0
    for (let offset = 0; offset < period; offset++) {
      const candle = candles[i - offset]
      if (!candle) break
      numerator += candle.close * candle.volume
      denominator += candle.volume
    }
    out[i] = denominator === 0 ? null : numerator / denominator
  }
  return out
}

/**
 * Rolling volume-weighted average price. A true session VWAP resets each day;
 * this uses a fixed window so it is meaningful on any timeframe.
 */
export function vwap(candles: Candle[], period = 20): Series {
  if (period <= 0) throw new Error('vwap: period must be > 0')
  const out: Series = new Array(candles.length).fill(null)
  for (let i = period - 1; i < candles.length; i++) {
    let pv = 0
    let volume = 0
    for (let offset = 0; offset < period; offset++) {
      const candle = candles[i - offset]
      if (!candle) break
      const typical = (candle.high + candle.low + candle.close) / 3
      pv += typical * candle.volume
      volume += candle.volume
    }
    out[i] = volume === 0 ? null : pv / volume
  }
  return out
}

/** Simple moving average of the typical price, used by CCI and others. */
export function typicalPrice(candles: Candle[]): Series {
  return candles.map((c) => (c.high + c.low + c.close) / 3)
}

export { sma, ema }
