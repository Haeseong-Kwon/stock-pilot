import type { Candle, Series } from '@/lib/types'
import { atr } from './atr'
import { ema } from './ema'
import { sma } from './sma'

export type Band = { upper: Series; middle: Series; lower: Series }

/** Keltner Channels: an EMA with ATR-scaled envelopes. */
export function keltner(candles: Candle[], period = 20, multiplier = 2, atrPeriod = 10): Band {
  const closes = candles.map((c) => c.close)
  const middle = ema(closes, period)
  const range = atr(candles, atrPeriod)
  const upper: Series = new Array(candles.length).fill(null)
  const lower: Series = new Array(candles.length).fill(null)

  for (let i = 0; i < candles.length; i++) {
    const mid = middle[i]
    const width = range[i]
    if (mid === null || mid === undefined || width === null || width === undefined) continue
    upper[i] = mid + width * multiplier
    lower[i] = mid - width * multiplier
  }
  return { upper, middle, lower }
}

/** Donchian Channels: the highest high and lowest low of the window. */
export function donchian(candles: Candle[], period = 20): Band {
  const upper: Series = new Array(candles.length).fill(null)
  const lower: Series = new Array(candles.length).fill(null)
  const middle: Series = new Array(candles.length).fill(null)

  for (let i = period - 1; i < candles.length; i++) {
    let high = -Infinity
    let low = Infinity
    for (let offset = 0; offset < period; offset++) {
      const candle = candles[i - offset]
      if (!candle) break
      high = Math.max(high, candle.high)
      low = Math.min(low, candle.low)
    }
    if (!Number.isFinite(high) || !Number.isFinite(low)) continue
    upper[i] = high
    lower[i] = low
    middle[i] = (high + low) / 2
  }
  return { upper, middle, lower }
}

export type SuperTrend = { trend: Series; direction: Series }

/**
 * SuperTrend: an ATR band that flips side when price closes through it.
 * `direction` is +1 while the trend is up and −1 while it is down.
 */
export function superTrend(candles: Candle[], period = 10, multiplier = 3): SuperTrend {
  const range = atr(candles, period)
  const trend: Series = new Array(candles.length).fill(null)
  const direction: Series = new Array(candles.length).fill(null)

  let upperBand: number | null = null
  let lowerBand: number | null = null
  let up = true

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]
    const width = range[i]
    if (!candle || width === null || width === undefined) continue

    const mid = (candle.high + candle.low) / 2
    const rawUpper = mid + multiplier * width
    const rawLower = mid - multiplier * width
    const previous = candles[i - 1]

    // Bands only tighten while the trend holds; they reset when price breaks through.
    upperBand =
      upperBand === null || !previous || previous.close > upperBand
        ? rawUpper
        : Math.min(rawUpper, upperBand)
    lowerBand =
      lowerBand === null || !previous || previous.close < lowerBand
        ? rawLower
        : Math.max(rawLower, lowerBand)

    if (candle.close > upperBand) up = true
    else if (candle.close < lowerBand) up = false

    trend[i] = up ? lowerBand : upperBand
    direction[i] = up ? 1 : -1
  }
  return { trend, direction }
}

/** Parabolic SAR — the classic Wilder stop-and-reverse dots. */
export function parabolicSar(candles: Candle[], step = 0.02, maxStep = 0.2): Series {
  const out: Series = new Array(candles.length).fill(null)
  const first = candles[0]
  const second = candles[1]
  if (!first || !second) return out

  let rising = second.close >= first.close
  let sar = rising ? first.low : first.high
  let extreme = rising ? second.high : second.low
  let acceleration = step

  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i]
    if (!candle) continue
    sar += acceleration * (extreme - sar)

    // The SAR may never sit inside the last two bars' range.
    const prev = candles[i - 1]
    const prev2 = candles[i - 2]
    if (rising) {
      if (prev) sar = Math.min(sar, prev.low)
      if (prev2) sar = Math.min(sar, prev2.low)
      if (candle.low < sar) {
        rising = false
        sar = extreme
        extreme = candle.low
        acceleration = step
      } else if (candle.high > extreme) {
        extreme = candle.high
        acceleration = Math.min(acceleration + step, maxStep)
      }
    } else {
      if (prev) sar = Math.max(sar, prev.high)
      if (prev2) sar = Math.max(sar, prev2.high)
      if (candle.high > sar) {
        rising = true
        sar = extreme
        extreme = candle.high
        acceleration = step
      } else if (candle.low < extreme) {
        extreme = candle.low
        acceleration = Math.min(acceleration + step, maxStep)
      }
    }
    out[i] = sar
  }
  return out
}

export type Ichimoku = {
  conversion: Series
  base: Series
  spanA: Series
  spanB: Series
  lagging: Series
}

/** Ichimoku Kinko Hyo. Spans are plotted where they are computed, not shifted. */
export function ichimoku(candles: Candle[], conversion = 9, base = 26, span = 52): Ichimoku {
  const midpoint = (period: number): Series => {
    const out: Series = new Array(candles.length).fill(null)
    for (let i = period - 1; i < candles.length; i++) {
      let high = -Infinity
      let low = Infinity
      for (let offset = 0; offset < period; offset++) {
        const candle = candles[i - offset]
        if (!candle) break
        high = Math.max(high, candle.high)
        low = Math.min(low, candle.low)
      }
      if (Number.isFinite(high) && Number.isFinite(low)) out[i] = (high + low) / 2
    }
    return out
  }

  const conversionLine = midpoint(conversion)
  const baseLine = midpoint(base)
  const spanA: Series = candles.map((_, i) => {
    const c = conversionLine[i]
    const b = baseLine[i]
    return c === null || c === undefined || b === null || b === undefined ? null : (c + b) / 2
  })
  const spanB = midpoint(span)
  const lagging: Series = candles.map((_, i) => candles[i + base]?.close ?? null)

  return { conversion: conversionLine, base: baseLine, spanA, spanB, lagging }
}

export { sma }
