import { describe, expect, it } from 'vitest'
import { atr, bollinger, ema, macd, rsi, sma, trueRange } from '@/lib/analysis/indicators'
import type { Candle } from '@/lib/types'

const seq = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i))

function candlesFrom(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    time: 1_700_000_000 + i * 86400,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000 + i,
  }))
}

describe('sma', () => {
  it('leaves warm-up bars null and averages the trailing window', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4])
  })

  it('is exact on a constant series', () => {
    expect(sma(seq(50, () => 7), 20).at(-1)).toBe(7)
  })

  it('rejects a non-positive period', () => {
    expect(() => sma([1, 2, 3], 0)).toThrow()
  })
})

describe('ema', () => {
  it('seeds from the SMA of the first window', () => {
    const values = [1, 2, 3, 4, 5]
    expect(ema(values, 3)[2]).toBe(2)
  })

  it('applies the smoothing factor afterwards', () => {
    // seed 2, k = 2/(3+1) = 0.5 -> 4 * 0.5 + 2 * 0.5 = 3
    expect(ema([1, 2, 3, 4, 5], 3)[3]).toBe(3)
  })

  it('converges to a constant series', () => {
    expect(ema(seq(200, () => 42), 20).at(-1)).toBeCloseTo(42, 6)
  })
})

describe('rsi', () => {
  it('is 100 when every bar gains', () => {
    expect(rsi(seq(40, (i) => 100 + i), 14).at(-1)).toBe(100)
  })

  it('is 0 when every bar loses', () => {
    expect(rsi(seq(40, (i) => 100 - i), 14).at(-1)).toBe(0)
  })

  it('stays within 0..100 on a noisy series', () => {
    const closes = seq(300, (i) => 100 + Math.sin(i / 3) * 10 + (i % 7))
    for (const value of rsi(closes, 14)) {
      if (value === null) continue
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  it('needs `period` changes before producing a value', () => {
    expect(rsi(seq(20, (i) => 100 + i), 14).slice(0, 14).every((v) => v === null)).toBe(true)
  })
})

describe('macd', () => {
  it('is zero on a flat series once both EMAs have warmed up', () => {
    const result = macd(seq(200, () => 50))
    expect(result.macd.at(-1)).toBeCloseTo(0, 8)
    expect(result.histogram.at(-1)).toBeCloseTo(0, 8)
  })

  it('is positive while price trends up', () => {
    const result = macd(seq(200, (i) => 50 + i))
    expect(result.macd.at(-1) as number).toBeGreaterThan(0)
  })

  it('rejects fast >= slow', () => {
    expect(() => macd([1, 2, 3], 26, 12)).toThrow()
  })
})

describe('bollinger', () => {
  it('collapses onto the mean when there is no variance', () => {
    const bands = bollinger(seq(40, () => 10), 20, 2)
    expect(bands.upper.at(-1)).toBe(10)
    expect(bands.lower.at(-1)).toBe(10)
  })

  it('keeps upper >= middle >= lower', () => {
    const bands = bollinger(seq(120, (i) => 100 + Math.sin(i) * 5), 20, 2)
    const i = 119
    expect(bands.upper[i]! >= bands.middle[i]!).toBe(true)
    expect(bands.middle[i]! >= bands.lower[i]!).toBe(true)
  })
})

describe('atr', () => {
  it('uses the bar range when there is no predecessor', () => {
    const candle = { time: 1, open: 5, high: 12, low: 8, close: 10, volume: 0 }
    expect(trueRange(candle, undefined)).toBe(4)
  })

  it('accounts for gaps against the previous close', () => {
    const prev = { time: 1, open: 5, high: 6, low: 4, close: 5, volume: 0 }
    const candle = { time: 2, open: 20, high: 21, low: 19, close: 20, volume: 0 }
    expect(trueRange(candle, prev)).toBe(16)
  })

  it('equals the constant range on a uniform series', () => {
    const candles = candlesFrom(seq(60, () => 100))
    expect(atr(candles, 14).at(-1)).toBeCloseTo(2, 8)
  })
})
