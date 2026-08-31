import type { Candle, Series } from '@/lib/types'
import { ema } from './ema'
import { sma } from './sma'
import { rsi } from './rsi'
import { trueRange } from './atr'
import { typicalPrice } from './movingAverages'

/**
 * Range oscillators are defined on 0..100. `sma` keeps a running sum, so
 * smoothing a series of exact 100s can land on 100.00000000000001 — enough to
 * make an `>= 100` condition behave inconsistently. Clamp at every boundary.
 */
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const clampSeries = (series: Series, min: number, max: number): Series =>
  series.map((value) => (value === null || value === undefined ? null : clamp(value, min, max)))

const rollingHigh = (candles: Candle[], i: number, period: number): number | null => {
  let high = -Infinity
  for (let offset = 0; offset < period; offset++) {
    const candle = candles[i - offset]
    if (!candle) return null
    high = Math.max(high, candle.high)
  }
  return Number.isFinite(high) ? high : null
}

const rollingLow = (candles: Candle[], i: number, period: number): number | null => {
  let low = Infinity
  for (let offset = 0; offset < period; offset++) {
    const candle = candles[i - offset]
    if (!candle) return null
    low = Math.min(low, candle.low)
  }
  return Number.isFinite(low) ? low : null
}

export type Stochastic = { k: Series; d: Series }

/** Stochastic oscillator: where the close sits inside the recent range, 0..100. */
export function stochastic(candles: Candle[], period = 14, smoothK = 3, smoothD = 3): Stochastic {
  const raw: Series = new Array(candles.length).fill(null)
  for (let i = period - 1; i < candles.length; i++) {
    const candle = candles[i]
    const high = rollingHigh(candles, i, period)
    const low = rollingLow(candles, i, period)
    if (!candle || high === null || low === null) continue
    raw[i] = high === low ? 50 : clamp(((candle.close - low) / (high - low)) * 100, 0, 100)
  }
  const k = clampSeries(smoothK > 1 ? sma(raw, smoothK) : raw, 0, 100)
  return { k, d: clampSeries(sma(k, smoothD), 0, 100) }
}

/** Stochastic applied to RSI rather than to price. */
export function stochasticRsi(
  closes: Series,
  rsiPeriod = 14,
  stochPeriod = 14,
  smoothK = 3,
  smoothD = 3,
): Stochastic {
  const values = rsi(closes, rsiPeriod)
  const raw: Series = new Array(values.length).fill(null)

  for (let i = stochPeriod - 1; i < values.length; i++) {
    let high = -Infinity
    let low = Infinity
    let ok = true
    for (let offset = 0; offset < stochPeriod; offset++) {
      const value = values[i - offset]
      if (value === null || value === undefined) {
        ok = false
        break
      }
      high = Math.max(high, value)
      low = Math.min(low, value)
    }
    const current = values[i]
    if (!ok || current === null || current === undefined) continue
    raw[i] = high === low ? 50 : clamp(((current - low) / (high - low)) * 100, 0, 100)
  }
  const k = clampSeries(sma(raw, smoothK), 0, 100)
  return { k, d: clampSeries(sma(k, smoothD), 0, 100) }
}

/** Commodity Channel Index — deviation from the mean typical price. */
export function cci(candles: Candle[], period = 20): Series {
  const typical = typicalPrice(candles)
  const mean = sma(typical, period)
  const out: Series = new Array(candles.length).fill(null)

  for (let i = period - 1; i < candles.length; i++) {
    const average = mean[i]
    if (average === null || average === undefined) continue
    let deviation = 0
    let ok = true
    for (let offset = 0; offset < period; offset++) {
      const value = typical[i - offset]
      if (value === null || value === undefined) {
        ok = false
        break
      }
      deviation += Math.abs(value - average)
    }
    const current = typical[i]
    if (!ok || current === null || current === undefined) continue
    const meanDeviation = deviation / period
    out[i] = meanDeviation === 0 ? 0 : (current - average) / (0.015 * meanDeviation)
  }
  return out
}

/** Williams %R — the Stochastic mirrored onto −100..0. */
export function williamsR(candles: Candle[], period = 14): Series {
  const out: Series = new Array(candles.length).fill(null)
  for (let i = period - 1; i < candles.length; i++) {
    const candle = candles[i]
    const high = rollingHigh(candles, i, period)
    const low = rollingLow(candles, i, period)
    if (!candle || high === null || low === null) continue
    out[i] = high === low ? -50 : clamp(((high - candle.close) / (high - low)) * -100, -100, 0)
  }
  return out
}

/** Rate of change, in percent. */
export function roc(values: Series, period = 12): Series {
  return values.map((value, i) => {
    const past = values[i - period]
    if (value === null || past === null || past === undefined || past === 0) return null
    return ((value - past) / past) * 100
  })
}

/** Absolute momentum: the difference against the bar `period` ago. */
export function momentum(values: Series, period = 10): Series {
  return values.map((value, i) => {
    const past = values[i - period]
    if (value === null || past === null || past === undefined) return null
    return value - past
  })
}

/** TRIX — the rate of change of a triple-smoothed EMA, in percent. */
export function trix(values: Series, period = 15): Series {
  const triple = ema(ema(ema(values, period), period), period)
  return triple.map((value, i) => {
    const past = triple[i - 1]
    if (value === null || past === null || past === undefined || past === 0) return null
    return ((value - past) / past) * 100
  })
}

export type Ppo = { ppo: Series; signal: Series; histogram: Series }

/** Percentage Price Oscillator — MACD expressed as a percentage. */
export function ppo(values: Series, fast = 12, slow = 26, signalPeriod = 9): Ppo {
  const fastEma = ema(values, fast)
  const slowEma = ema(values, slow)
  const line: Series = values.map((_, i) => {
    const f = fastEma[i]
    const s = slowEma[i]
    if (f === null || f === undefined || s === null || s === undefined || s === 0) return null
    return ((f - s) / s) * 100
  })
  const signal = ema(line, signalPeriod)
  const histogram: Series = line.map((value, i) => {
    const s = signal[i]
    return value === null || s === null || s === undefined ? null : value - s
  })
  return { ppo: line, signal, histogram }
}

/** Detrended Price Oscillator — price minus a shifted SMA, removing the trend. */
export function dpo(values: Series, period = 20): Series {
  const average = sma(values, period)
  const shift = Math.floor(period / 2) + 1
  return values.map((value, i) => {
    const reference = average[i - shift]
    if (value === null || reference === null || reference === undefined) return null
    return value - reference
  })
}

/** Awesome Oscillator — SMA(5) minus SMA(34) of the median price. */
export function awesomeOscillator(candles: Candle[], fast = 5, slow = 34): Series {
  const median = candles.map((c) => (c.high + c.low) / 2)
  const fastMa = sma(median, fast)
  const slowMa = sma(median, slow)
  return candles.map((_, i) => {
    const f = fastMa[i]
    const s = slowMa[i]
    return f === null || f === undefined || s === null || s === undefined ? null : f - s
  })
}

/** Ultimate Oscillator — buying pressure blended over three timeframes. */
export function ultimateOscillator(candles: Candle[], short = 7, medium = 14, long = 28): Series {
  const out: Series = new Array(candles.length).fill(null)
  const bp: number[] = []
  const tr: number[] = []

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]
    const previous = candles[i - 1]
    if (!candle) continue
    const low = previous ? Math.min(candle.low, previous.close) : candle.low
    bp[i] = candle.close - low
    tr[i] = trueRange(candle, previous)
  }

  const sum = (arr: number[], i: number, period: number): number | null => {
    if (i < period - 1) return null
    let total = 0
    for (let offset = 0; offset < period; offset++) {
      const value = arr[i - offset]
      if (value === undefined) return null
      total += value
    }
    return total
  }

  for (let i = long - 1; i < candles.length; i++) {
    const parts = [short, medium, long].map((period) => {
      const bpSum = sum(bp, i, period)
      const trSum = sum(tr, i, period)
      return bpSum === null || trSum === null || trSum === 0 ? null : bpSum / trSum
    })
    if (parts.some((p) => p === null)) continue
    const [a, b, c] = parts as [number, number, number]
    out[i] = clamp(((4 * a + 2 * b + c) / 7) * 100, 0, 100)
  }
  return out
}

export type Adx = { adx: Series; plusDi: Series; minusDi: Series }

/** Wilder's ADX with the directional indicators. */
export function adx(candles: Candle[], period = 14): Adx {
  const length = candles.length
  const plusDi: Series = new Array(length).fill(null)
  const minusDi: Series = new Array(length).fill(null)
  const adxLine: Series = new Array(length).fill(null)

  let smoothTr = 0
  let smoothPlus = 0
  let smoothMinus = 0
  let adxSum = 0
  let dxCount = 0
  let previousAdx: number | null = null

  for (let i = 1; i < length; i++) {
    const candle = candles[i]
    const previous = candles[i - 1]
    if (!candle || !previous) continue

    const upMove = candle.high - previous.high
    const downMove = previous.low - candle.low
    const plusDm = upMove > downMove && upMove > 0 ? upMove : 0
    const minusDm = downMove > upMove && downMove > 0 ? downMove : 0
    const tr = trueRange(candle, previous)

    if (i <= period) {
      smoothTr += tr
      smoothPlus += plusDm
      smoothMinus += minusDm
      if (i < period) continue
    } else {
      // Wilder smoothing.
      smoothTr = smoothTr - smoothTr / period + tr
      smoothPlus = smoothPlus - smoothPlus / period + plusDm
      smoothMinus = smoothMinus - smoothMinus / period + minusDm
    }

    if (smoothTr === 0) continue
    const plus = (smoothPlus / smoothTr) * 100
    const minus = (smoothMinus / smoothTr) * 100
    plusDi[i] = plus
    minusDi[i] = minus

    const denominator = plus + minus
    const dx = denominator === 0 ? 0 : (Math.abs(plus - minus) / denominator) * 100

    if (previousAdx === null) {
      adxSum += dx
      dxCount++
      if (dxCount === period) {
        previousAdx = adxSum / period
        adxLine[i] = previousAdx
      }
    } else {
      previousAdx = (previousAdx * (period - 1) + dx) / period
      adxLine[i] = previousAdx
    }
  }
  return { adx: adxLine, plusDi, minusDi }
}

export type Aroon = { up: Series; down: Series }

/** Aroon — how recently the window's high and low occurred, 0..100. */
export function aroon(candles: Candle[], period = 14): Aroon {
  const up: Series = new Array(candles.length).fill(null)
  const down: Series = new Array(candles.length).fill(null)

  for (let i = period; i < candles.length; i++) {
    let highIndex = i
    let lowIndex = i
    let high = -Infinity
    let low = Infinity
    for (let offset = 0; offset <= period; offset++) {
      const candle = candles[i - offset]
      if (!candle) break
      if (candle.high > high) {
        high = candle.high
        highIndex = i - offset
      }
      if (candle.low < low) {
        low = candle.low
        lowIndex = i - offset
      }
    }
    up[i] = ((period - (i - highIndex)) / period) * 100
    down[i] = ((period - (i - lowIndex)) / period) * 100
  }
  return { up, down }
}

export type Vortex = { plus: Series; minus: Series }

/** Vortex indicator — competing up and down movement. */
export function vortex(candles: Candle[], period = 14): Vortex {
  const plus: Series = new Array(candles.length).fill(null)
  const minus: Series = new Array(candles.length).fill(null)
  const vmPlus: number[] = []
  const vmMinus: number[] = []
  const tr: number[] = []

  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i]
    const previous = candles[i - 1]
    if (!candle || !previous) continue
    vmPlus[i] = Math.abs(candle.high - previous.low)
    vmMinus[i] = Math.abs(candle.low - previous.high)
    tr[i] = trueRange(candle, previous)
  }

  for (let i = period; i < candles.length; i++) {
    let sumPlus = 0
    let sumMinus = 0
    let sumTr = 0
    let ok = true
    for (let offset = 0; offset < period; offset++) {
      const p = vmPlus[i - offset]
      const m = vmMinus[i - offset]
      const t = tr[i - offset]
      if (p === undefined || m === undefined || t === undefined) {
        ok = false
        break
      }
      sumPlus += p
      sumMinus += m
      sumTr += t
    }
    if (!ok || sumTr === 0) continue
    plus[i] = sumPlus / sumTr
    minus[i] = sumMinus / sumTr
  }
  return { plus, minus }
}

/** Choppiness Index — 100 means pure range, 0 means pure trend. */
export function choppiness(candles: Candle[], period = 14): Series {
  const out: Series = new Array(candles.length).fill(null)
  const denominator = Math.log10(period)

  for (let i = period; i < candles.length; i++) {
    let trSum = 0
    let high = -Infinity
    let low = Infinity
    let ok = true
    for (let offset = 0; offset < period; offset++) {
      const candle = candles[i - offset]
      const previous = candles[i - offset - 1]
      if (!candle) {
        ok = false
        break
      }
      trSum += trueRange(candle, previous)
      high = Math.max(high, candle.high)
      low = Math.min(low, candle.low)
    }
    const range = high - low
    if (!ok || range <= 0 || trSum <= 0) continue
    out[i] = (100 * Math.log10(trSum / range)) / denominator
  }
  return out
}

export type ElderRay = { bull: Series; bear: Series }

/** Elder Ray — how far the bar's extremes reach beyond the EMA. */
export function elderRay(candles: Candle[], period = 13): ElderRay {
  const baseline = ema(
    candles.map((c) => c.close),
    period,
  )
  const bull: Series = new Array(candles.length).fill(null)
  const bear: Series = new Array(candles.length).fill(null)

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]
    const base = baseline[i]
    if (!candle || base === null || base === undefined) continue
    bull[i] = candle.high - base
    bear[i] = candle.low - base
  }
  return { bull, bear }
}
