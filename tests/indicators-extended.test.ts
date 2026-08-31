import { describe, expect, it } from 'vitest'
import type { Candle, Series } from '@/lib/types'
import {
  INDICATOR_REGISTRY,
  INDICATOR_TYPES,
  computeIndicator,
  indicatorSpec,
  resolveParams,
  type IndicatorType,
} from '@/lib/analysis/indicators/registry'
import { dema, hma, tema, vwap, vwma, wma } from '@/lib/analysis/indicators/movingAverages'
import { donchian, ichimoku, keltner, parabolicSar, superTrend } from '@/lib/analysis/indicators/channels'
import {
  adx, aroon, awesomeOscillator, cci, choppiness, dpo, elderRay, momentum, ppo, roc,
  stochastic, stochasticRsi, trix, ultimateOscillator, vortex, williamsR,
} from '@/lib/analysis/indicators/momentum'
import { adLine, cmf, easeOfMovement, forceIndex, mfi, obv, volumeOscillator } from '@/lib/analysis/indicators/volume'
import { bollingerWidth, normalizedAtr, standardDeviation } from '@/lib/analysis/indicators/volatilityBands'

const DAY = 86400
const START = Date.UTC(2024, 0, 1) / 1000

function bars(closes: number[], volumes?: number[]): Candle[] {
  return closes.map((close, i) => ({
    time: START + i * DAY,
    open: i === 0 ? close : (closes[i - 1] as number),
    high: close + 1,
    low: close - 1,
    close,
    volume: volumes?.[i] ?? 1_000_000,
  }))
}

const rising = bars(Array.from({ length: 120 }, (_, i) => 100 + i))
const falling = bars(Array.from({ length: 120 }, (_, i) => 220 - i))
const flat = bars(new Array(120).fill(100))
const wavy = bars(Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 7) * 10 + i * 0.05))

/** Closes sit exactly at the extremes, so range oscillators can reach 0 and 100. */
function flatWickBars(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    time: START + i * DAY,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1_000_000,
  }))
}

/** Closes finish at the top of each bar, which is what A/D and CMF measure. */
function strongCloseBars(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    time: START + i * DAY,
    open: close - 1,
    high: close,
    low: close - 2,
    close,
    volume: 1_000_000,
  }))
}

const last = (s: Series) => s.at(-1)
const finite = (s: Series) => s.filter((v): v is number => v !== null && Number.isFinite(v))

describe('moving averages', () => {
  it('wma weights the newest bar most', () => {
    // (1*1 + 2*2 + 3*3) / 6 = 2.333…
    expect(wma([1, 2, 3], 3)?.[2]).toBeCloseTo(14 / 6, 10)
  })

  it('every average converges on a constant series', () => {
    const constant: Series = new Array(200).fill(42)
    for (const fn of [wma, hma, dema, tema]) {
      expect(last(fn(constant, 20)), fn.name).toBeCloseTo(42, 6)
    }
  })

  it('hma tracks a trend more closely than wma', () => {
    const closes = rising.map((c) => c.close)
    const gapHma = Math.abs((last(hma(closes, 20)) as number) - (closes.at(-1) as number))
    const gapWma = Math.abs((last(wma(closes, 20)) as number) - (closes.at(-1) as number))
    expect(gapHma).toBeLessThan(gapWma)
  })

  it('vwma equals sma when volume is uniform', () => {
    const uniform = bars([10, 20, 30, 40, 50])
    expect(last(vwma(uniform, 5))).toBeCloseTo(30, 10)
  })

  it('vwma leans toward the heavily traded bar', () => {
    const skewed = bars([10, 20, 30], [1, 1, 98])
    expect(last(vwma(skewed, 3)) as number).toBeGreaterThan(25)
  })

  it('vwap sits inside the bar range', () => {
    const value = last(vwap(wavy, 20)) as number
    const window = wavy.slice(-20)
    expect(value).toBeGreaterThanOrEqual(Math.min(...window.map((c) => c.low)))
    expect(value).toBeLessThanOrEqual(Math.max(...window.map((c) => c.high)))
  })
})

describe('channels and trend', () => {
  it('keltner brackets its own basis', () => {
    const band = keltner(wavy)
    const i = wavy.length - 1
    expect(band.upper[i] as number).toBeGreaterThan(band.middle[i] as number)
    expect(band.lower[i] as number).toBeLessThan(band.middle[i] as number)
  })

  it('donchian returns the window extremes exactly', () => {
    const candles = bars([10, 30, 20, 15, 25])
    const band = donchian(candles, 5)
    expect(last(band.upper)).toBe(31) // high = close + 1
    expect(last(band.lower)).toBe(9) // low = close - 1
  })

  it('supertrend follows below a rising market and above a falling one', () => {
    const up = superTrend(rising)
    const down = superTrend(falling)
    expect(last(up.direction)).toBe(1)
    expect(last(up.trend) as number).toBeLessThan(rising.at(-1)!.close)
    expect(last(down.direction)).toBe(-1)
    expect(last(down.trend) as number).toBeGreaterThan(falling.at(-1)!.close)
  })

  it('parabolic sar stays on the correct side of the trend', () => {
    expect(last(parabolicSar(rising)) as number).toBeLessThan(rising.at(-1)!.close)
    expect(last(parabolicSar(falling)) as number).toBeGreaterThan(falling.at(-1)!.close)
  })

  it('ichimoku conversion reacts faster than the base line', () => {
    const cloud = ichimoku(rising)
    expect(last(cloud.conversion) as number).toBeGreaterThan(last(cloud.base) as number)
    expect(finite(cloud.spanA).length).toBeGreaterThan(0)
    expect(finite(cloud.spanB).length).toBeGreaterThan(0)
  })
})

describe('momentum', () => {
  it('stochastic pins to 100 at the top of the range and 0 at the bottom', () => {
    const up = flatWickBars(Array.from({ length: 60 }, (_, i) => 100 + i))
    const down = flatWickBars(Array.from({ length: 60 }, (_, i) => 160 - i))
    expect(last(stochastic(up, 14, 1, 1).k)).toBeCloseTo(100, 6)
    expect(last(stochastic(down, 14, 1, 1).k)).toBeCloseTo(0, 6)
  })

  it('stochastic rsi stays inside 0..100', () => {
    for (const value of finite(stochasticRsi(wavy.map((c) => c.close)).k)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  it('williams %r stays inside -100..0 and mirrors the stochastic', () => {
    const up = flatWickBars(Array.from({ length: 60 }, (_, i) => 100 + i))
    const down = flatWickBars(Array.from({ length: 60 }, (_, i) => 160 - i))
    expect(last(williamsR(up))).toBeCloseTo(0, 6)
    expect(last(williamsR(down))).toBeCloseTo(-100, 6)
    for (const value of finite(williamsR(wavy))) {
      expect(value).toBeGreaterThanOrEqual(-100)
      expect(value).toBeLessThanOrEqual(0)
    }
  })

  it('cci is positive above the mean and negative below', () => {
    expect(last(cci(rising)) as number).toBeGreaterThan(0)
    expect(last(cci(falling)) as number).toBeLessThan(0)
  })

  it('roc and momentum agree on direction', () => {
    const closes = rising.map((c) => c.close)
    expect(last(roc(closes, 10)) as number).toBeGreaterThan(0)
    expect(last(momentum(closes, 10))).toBe(10)
  })

  it('trix and ppo are zero on a flat market', () => {
    const closes = flat.map((c) => c.close)
    expect(last(trix(closes, 5))).toBeCloseTo(0, 8)
    expect(last(ppo(closes).ppo)).toBeCloseTo(0, 8)
  })

  it('dpo removes the trend, so a straight line collapses to a constant', () => {
    const values = finite(dpo(rising.map((c) => c.close), 20))
    expect(Math.max(...values) - Math.min(...values)).toBeCloseTo(0, 6)
  })

  it('awesome oscillator is positive while the median price rises', () => {
    expect(last(awesomeOscillator(rising)) as number).toBeGreaterThan(0)
    expect(last(awesomeOscillator(falling)) as number).toBeLessThan(0)
  })

  it('ultimate oscillator stays inside 0..100', () => {
    for (const value of finite(ultimateOscillator(wavy))) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  it('adx reports a strong trend and the right direction', () => {
    const up = adx(rising)
    expect(last(up.adx) as number).toBeGreaterThan(25)
    expect(last(up.plusDi) as number).toBeGreaterThan(last(up.minusDi) as number)
    const down = adx(falling)
    expect(last(down.minusDi) as number).toBeGreaterThan(last(down.plusDi) as number)
  })

  it('aroon reaches 100 up in a rally and 100 down in a slide', () => {
    expect(last(aroon(rising).up)).toBe(100)
    expect(last(aroon(falling).down)).toBe(100)
  })

  it('vortex favours the direction of travel', () => {
    expect(last(vortex(rising).plus) as number).toBeGreaterThan(last(vortex(rising).minus) as number)
  })

  it('choppiness is lower on a clean trend than on a flat range', () => {
    const trending = last(choppiness(rising)) as number
    const ranging = last(choppiness(bars(Array.from({ length: 120 }, (_, i) => 100 + (i % 2))))) as number
    expect(trending).toBeLessThan(ranging)
  })

  it('elder ray shows bull power above bear power', () => {
    const ray = elderRay(wavy)
    expect(last(ray.bull) as number).toBeGreaterThan(last(ray.bear) as number)
  })
})

describe('volume', () => {
  it('obv accumulates on up days and gives it back on down days', () => {
    const candles = bars([10, 11, 10], [100, 200, 300])
    expect(obv(candles)).toEqual([0, 200, -100])
  })

  it('mfi stays inside 0..100 and is high in a rally', () => {
    expect(last(mfi(rising)) as number).toBeGreaterThan(80)
    for (const value of finite(mfi(wavy))) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  it('cmf is positive when closes finish strong', () => {
    const strong = strongCloseBars(Array.from({ length: 60 }, (_, i) => 100 + i))
    expect(last(cmf(strong)) as number).toBeGreaterThan(0.5)
  })

  it('cmf stays inside -1..1', () => {
    for (const value of finite(cmf(wavy))) {
      expect(Math.abs(value)).toBeLessThanOrEqual(1)
    }
  })

  it('a/d line rises when closes finish near the high', () => {
    const strong = strongCloseBars(Array.from({ length: 60 }, (_, i) => 100 + i))
    expect(last(adLine(strong)) as number).toBeGreaterThan(0)
    // A close exactly mid-bar contributes nothing, by definition.
    expect(last(adLine(bars([10, 11, 12])))).toBe(0)
  })

  it('force index is positive while price advances', () => {
    expect(last(forceIndex(rising)) as number).toBeGreaterThan(0)
    expect(last(forceIndex(falling)) as number).toBeLessThan(0)
  })

  it('ease of movement is positive when price rises on light volume', () => {
    expect(last(easeOfMovement(rising)) as number).toBeGreaterThan(0)
  })

  it('volume oscillator is zero when volume is constant', () => {
    expect(last(volumeOscillator(flat))).toBeCloseTo(0, 8)
  })
})

describe('volatility', () => {
  it('normalized atr is a percentage of price', () => {
    const value = last(normalizedAtr(wavy)) as number
    expect(value).toBeGreaterThan(0)
    expect(value).toBeLessThan(100)
  })

  it('standard deviation is zero on a flat series', () => {
    expect(last(standardDeviation(new Array(60).fill(5), 20))).toBeCloseTo(0, 10)
  })

  it('bollinger width widens with volatility', () => {
    const calm = last(bollingerWidth(Array.from({ length: 60 }, (_, i) => 100 + (i % 2)), 20)) as number
    const wild = last(bollingerWidth(Array.from({ length: 60 }, (_, i) => 100 + (i % 2) * 30), 20)) as number
    expect(wild).toBeGreaterThan(calm)
  })
})

describe('registry', () => {
  it('exposes a rich catalogue across every category', () => {
    expect(INDICATOR_TYPES.length).toBeGreaterThanOrEqual(35)
    const categories = new Set(Object.values(INDICATOR_REGISTRY).map((s) => s.category))
    expect([...categories].sort()).toEqual(['momentum', 'trend', 'volatility', 'volume'])
  })

  it('computes every indicator without throwing and returns each declared output', () => {
    for (const type of INDICATOR_TYPES) {
      const spec = indicatorSpec(type)
      const outputs = computeIndicator(type, wavy)
      for (const output of spec.outputs) {
        const series = outputs[output.key]
        expect(series, `${type}.${output.key}`).toBeDefined()
        expect(series, `${type}.${output.key} length`).toHaveLength(wavy.length)
      }
    }
  })

  it('produces at least one real value for every indicator on 300 bars', () => {
    for (const type of INDICATOR_TYPES) {
      const spec = indicatorSpec(type)
      const outputs = computeIndicator(type, wavy)
      for (const output of spec.outputs) {
        expect(finite(outputs[output.key] ?? []).length, `${type}.${output.key}`).toBeGreaterThan(0)
      }
    }
  })

  it('survives a short series without throwing', () => {
    for (const type of INDICATOR_TYPES) {
      expect(() => computeIndicator(type, bars([1, 2, 3])), type).not.toThrow()
      expect(() => computeIndicator(type, []), type).not.toThrow()
    }
  })

  it('clamps an out-of-range parameter instead of hanging or rejecting', () => {
    expect(resolveParams('SMA' as IndicatorType, { period: 999_999 }).period).toBe(1000)
    expect(resolveParams('SMA' as IndicatorType, { period: 0 }).period).toBe(1)
    expect(resolveParams('RSI' as IndicatorType, {}).period).toBe(14)
  })
})
