import type { Candle, Series } from '@/lib/types'
import { ema } from './ema'
import { sma } from './sma'
import { typicalPrice } from './movingAverages'

/** On Balance Volume — cumulative volume signed by the day's direction. */
export function obv(candles: Candle[]): Series {
  const out: Series = new Array(candles.length).fill(null)
  let total = 0
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]
    const previous = candles[i - 1]
    if (!candle) continue
    if (previous) {
      if (candle.close > previous.close) total += candle.volume
      else if (candle.close < previous.close) total -= candle.volume
    }
    out[i] = total
  }
  return out
}

/** Money Flow Index — a volume-weighted RSI, 0..100. */
export function mfi(candles: Candle[], period = 14): Series {
  const typical = typicalPrice(candles)
  const out: Series = new Array(candles.length).fill(null)
  const positive: number[] = []
  const negative: number[] = []

  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i]
    const current = typical[i]
    const previous = typical[i - 1]
    if (!candle || current === null || current === undefined || previous === null || previous === undefined) {
      continue
    }
    const flow = current * candle.volume
    positive[i] = current > previous ? flow : 0
    negative[i] = current < previous ? flow : 0
  }

  for (let i = period; i < candles.length; i++) {
    let up = 0
    let down = 0
    let ok = true
    for (let offset = 0; offset < period; offset++) {
      const p = positive[i - offset]
      const n = negative[i - offset]
      if (p === undefined || n === undefined) {
        ok = false
        break
      }
      up += p
      down += n
    }
    if (!ok) continue
    out[i] = down === 0 ? 100 : 100 - 100 / (1 + up / down)
  }
  return out
}

/** Accumulation/Distribution Line — cumulative money-flow volume. */
export function adLine(candles: Candle[]): Series {
  const out: Series = new Array(candles.length).fill(null)
  let total = 0
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]
    if (!candle) continue
    const range = candle.high - candle.low
    const multiplier = range === 0 ? 0 : ((candle.close - candle.low) - (candle.high - candle.close)) / range
    total += multiplier * candle.volume
    out[i] = total
  }
  return out
}

/** Chaikin Money Flow — money-flow volume over total volume in the window. */
export function cmf(candles: Candle[], period = 20): Series {
  const out: Series = new Array(candles.length).fill(null)
  for (let i = period - 1; i < candles.length; i++) {
    let flow = 0
    let volume = 0
    let ok = true
    for (let offset = 0; offset < period; offset++) {
      const candle = candles[i - offset]
      if (!candle) {
        ok = false
        break
      }
      const range = candle.high - candle.low
      const multiplier =
        range === 0 ? 0 : ((candle.close - candle.low) - (candle.high - candle.close)) / range
      flow += multiplier * candle.volume
      volume += candle.volume
    }
    if (!ok || volume === 0) continue
    out[i] = flow / volume
  }
  return out
}

/** Chaikin Oscillator — the MACD of the A/D line. */
export function chaikinOscillator(candles: Candle[], fast = 3, slow = 10): Series {
  const line = adLine(candles)
  const fastEma = ema(line, fast)
  const slowEma = ema(line, slow)
  return candles.map((_, i) => {
    const f = fastEma[i]
    const s = slowEma[i]
    return f === null || f === undefined || s === null || s === undefined ? null : f - s
  })
}

/** Force Index — price change scaled by volume, then smoothed. */
export function forceIndex(candles: Candle[], period = 13): Series {
  const raw: Series = candles.map((candle, i) => {
    const previous = candles[i - 1]
    return previous ? (candle.close - previous.close) * candle.volume : null
  })
  return period > 1 ? ema(raw, period) : raw
}

/** Ease of Movement — how far price moved per unit of volume. */
export function easeOfMovement(candles: Candle[], period = 14, scale = 1_000_000): Series {
  const raw: Series = candles.map((candle, i) => {
    const previous = candles[i - 1]
    if (!previous) return null
    const distance = (candle.high + candle.low) / 2 - (previous.high + previous.low) / 2
    const range = candle.high - candle.low
    if (candle.volume === 0 || range === 0) return 0
    return distance / (candle.volume / scale / range)
  })
  return sma(raw, period)
}

/** Volume oscillator — the percentage gap between two volume averages. */
export function volumeOscillator(candles: Candle[], fast = 5, slow = 20): Series {
  const volumes = candles.map((c) => c.volume)
  const fastMa = sma(volumes, fast)
  const slowMa = sma(volumes, slow)
  return candles.map((_, i) => {
    const f = fastMa[i]
    const s = slowMa[i]
    if (f === null || f === undefined || s === null || s === undefined || s === 0) return null
    return ((f - s) / s) * 100
  })
}
