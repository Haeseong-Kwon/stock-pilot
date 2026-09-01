import { describe, expect, it } from 'vitest'
import type { Candle } from '@/lib/types'
import {
  FIB_RATIOS,
  fibonacciRetracement,
  findTrendlines,
  pivotPoints,
  regressionChannel,
} from '@/lib/analysis/drawing'
import { DEFAULT_DRAWING_BARS, scopedCandles } from '@/lib/chart/commandExecutor'

const DAY = 86400
const START = Date.UTC(2024, 0, 1) / 1000

/** Bars whose high/low sit a fixed wick away from the close. */
const bars = (closes: number[], wick = 1): Candle[] =>
  closes.map((close, i) => ({
    time: START + i * DAY,
    open: close,
    high: close + wick,
    low: close - wick,
    close,
    volume: 1000,
  }))

/** Explicit OHLC, for shapes a close-only series cannot express. */
const ohlc = (rows: Array<[number, number]>): Candle[] =>
  rows.map(([high, low], i) => ({
    time: START + i * DAY,
    open: (high + low) / 2,
    high,
    low,
    close: (high + low) / 2,
    volume: 1000,
  }))

describe('pivotPoints', () => {
  it('finds the peak of a tent and the trough of a valley', () => {
    const tent = ohlc([[10, 9], [12, 11], [20, 19], [12, 11], [10, 9]])
    const highs = pivotPoints(tent, 2).filter((p) => p.kind === 'high')
    expect(highs).toHaveLength(1)
    expect(highs[0]?.index).toBe(2)
    expect(highs[0]?.price).toBe(20)
  })

  it('ignores the edges, where dominance cannot be judged', () => {
    const rising = bars([1, 2, 3, 4, 5])
    expect(pivotPoints(rising, 2).every((p) => p.index >= 2 && p.index <= 2)).toBe(true)
  })

  it('is empty on a series shorter than the window needs', () => {
    expect(pivotPoints(bars([1, 2, 3]), 3)).toEqual([])
  })
})

describe('findTrendlines', () => {
  it('draws a descending resistance line that touches every peak', () => {
    // Peaks at 100, 90, 80 with troughs between: a clean falling ceiling.
    const rows: Array<[number, number]> = []
    const peaks = [100, 90, 80]
    for (const peak of peaks) {
      rows.push([peak - 20, peak - 22], [peak - 10, peak - 12], [peak, peak - 2],
                [peak - 10, peak - 12], [peak - 20, peak - 22])
    }
    const [line] = findTrendlines(ohlc(rows), { pivotWindow: 2, tolerance: 0.02 })
    expect(line?.kind).toBe('resistance')
    expect(line?.touches).toBeGreaterThanOrEqual(3)
    expect(line?.from.price).toBeCloseTo(100, 6)
    // Extended to the last bar, so it must keep falling.
    expect(line!.to.price).toBeLessThan(line!.from.price)
  })

  it('draws an ascending support line under rising troughs', () => {
    const rows: Array<[number, number]> = []
    const troughs = [10, 20, 30]
    for (const trough of troughs) {
      rows.push([trough + 22, trough + 20], [trough + 12, trough + 10], [trough + 2, trough],
                [trough + 12, trough + 10], [trough + 22, trough + 20])
    }
    const lines = findTrendlines(ohlc(rows), { pivotWindow: 2, tolerance: 0.02 })
    const support = lines.find((l) => l.kind === 'support')
    expect(support?.touches).toBeGreaterThanOrEqual(3)
    expect(support!.to.price).toBeGreaterThan(support!.from.price)
  })

  it('never fits a line through price it would have to pass through', () => {
    const rows: Array<[number, number]> = [
      [100, 98], [90, 88], [140, 138], [90, 88], [100, 98], [95, 93], [90, 88],
    ]
    const candles = ohlc(rows)
    for (const line of findTrendlines(candles, { pivotWindow: 1, tolerance: 0.01 })) {
      if (line.kind !== 'resistance') continue
      const slope = (line.to.price - line.from.price) / (line.to.time - line.from.time)
      const until = line.brokenAt ?? line.to.time
      // Between the anchors and up to any break, price must respect the line.
      for (const candle of candles) {
        if (candle.time < line.from.time || candle.time >= until) continue
        const at = line.from.price + slope * (candle.time - line.from.time)
        expect(candle.high).toBeLessThanOrEqual(at * 1.02)
      }
    }
  })

  it('reports where an extended line was breached', () => {
    // A flat ceiling at 100 that price clears decisively on the last bars.
    const rows: Array<[number, number]> = [
      [100, 90], [92, 85], [100, 90], [92, 85], [100, 90], [92, 85], [130, 120], [135, 125],
    ]
    const candles = ohlc(rows)
    const resistance = findTrendlines(candles, { pivotWindow: 1, tolerance: 0.01 })
      .find((l) => l.kind === 'resistance')
    expect(resistance?.brokenAt).toBe(candles[6]?.time)
  })

  it('prefers a line that still holds over a longer one already broken', () => {
    const rows: Array<[number, number]> = [
      [100, 90], [92, 85], [100, 90], [92, 85], [130, 120],
      [120, 110], [130, 120], [120, 110], [130, 120],
    ]
    const resistance = findTrendlines(ohlc(rows), { pivotWindow: 1, tolerance: 0.02 })
      .find((l) => l.kind === 'resistance')
    expect(resistance?.brokenAt).toBeUndefined()
  })

  it('anchors on real bars, never on invented coordinates', () => {
    const candles = ohlc(
      Array.from({ length: 60 }, (_, i) => [100 + Math.sin(i / 4) * 10, 98 + Math.sin(i / 4) * 10] as [number, number]),
    )
    const times = new Set(candles.map((c) => c.time))
    for (const line of findTrendlines(candles, { pivotWindow: 2 })) {
      expect(times.has(line.from.time)).toBe(true)
      expect(line.to.time).toBe(candles.at(-1)!.time)
    }
  })

  it('returns nothing rather than a made-up line on too little data', () => {
    expect(findTrendlines(bars([1, 2, 3]))).toEqual([])
    expect(findTrendlines([])).toEqual([])
  })
})

describe('fibonacciRetracement', () => {
  const rally = bars([100, 110, 130, 150, 200, 180, 170])

  it('anchors on the swing low and the swing high', () => {
    const fib = fibonacciRetracement(rally)!
    expect(fib.direction).toBe('up')
    expect(fib.from.price).toBe(99) // low - wick
    expect(fib.to.price).toBe(201) // high + wick
  })

  it('places 0% at the end of the swing and 100% back at its start', () => {
    const fib = fibonacciRetracement(rally)!
    const byRatio = new Map(fib.levels.map((l) => [l.ratio, l.price]))
    expect(byRatio.get(0)).toBeCloseTo(201, 6)
    expect(byRatio.get(1)).toBeCloseTo(99, 6)
    expect(byRatio.get(0.5)).toBeCloseTo(150, 6)
  })

  it('puts every standard ratio in between, in order', () => {
    const fib = fibonacciRetracement(rally)!
    expect(fib.levels.map((l) => l.ratio)).toEqual([...FIB_RATIOS])
    const prices = fib.levels.map((l) => l.price)
    expect([...prices].sort((a, b) => b - a)).toEqual(prices)
  })

  it('flips direction when the high came first', () => {
    const decline = fibonacciRetracement(bars([200, 180, 150, 120, 100]))!
    expect(decline.direction).toBe('down')
    expect(decline.to.price).toBe(99)
  })

  it('adds extensions only when asked', () => {
    expect(fibonacciRetracement(rally)!.levels).toHaveLength(FIB_RATIOS.length)
    expect(fibonacciRetracement(rally, { extend: true })!.levels).toHaveLength(FIB_RATIOS.length + 2)
  })

  it('refuses when there is no real swing to measure', () => {
    expect(fibonacciRetracement(bars([100, 100.5, 100, 100.2]), { minSwing: 0.05 })).toBeNull()
    expect(fibonacciRetracement(bars([1]))).toBeNull()
  })
})

describe('regressionChannel', () => {
  it('fits a straight line exactly and reports a perfect fit', () => {
    const channel = regressionChannel(bars(Array.from({ length: 50 }, (_, i) => 100 + i * 2)))!
    expect(channel.slope).toBeCloseTo(2, 6)
    expect(channel.fit).toBeCloseTo(1, 6)
    // No residuals, so the channel collapses onto the line.
    expect(channel.to.upper - channel.to.center).toBeCloseTo(0, 6)
  })

  it('widens the channel when the moves scatter', () => {
    const noisy = bars(Array.from({ length: 60 }, (_, i) => 100 + i + (i % 2 ? 12 : -12)))
    const channel = regressionChannel(noisy)!
    expect(channel.to.upper - channel.to.center).toBeGreaterThan(5)
    expect(channel.fit).toBeLessThan(1)
  })

  it('keeps upper above centre above lower at both ends', () => {
    const channel = regressionChannel(bars(Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i) * 5)))!
    for (const end of [channel.from, channel.to]) {
      expect(end.upper).toBeGreaterThanOrEqual(end.center)
      expect(end.center).toBeGreaterThanOrEqual(end.lower)
    }
  })

  it('reports a falling slope on a decline', () => {
    expect(regressionChannel(bars(Array.from({ length: 30 }, (_, i) => 200 - i * 3)))!.slope)
      .toBeCloseTo(-3, 6)
  })

  it('returns null when there is not enough to fit', () => {
    expect(regressionChannel(bars([1, 2]))).toBeNull()
  })
})

describe('drawing window', () => {
  const long = bars(Array.from({ length: 600 }, (_, i) => (i < 300 ? 100 + i : 400 - (i - 300))))

  it('covers the recent past when no window is named', () => {
    const scoped = scopedCandles(long, undefined)
    expect(scoped).toHaveLength(DEFAULT_DRAWING_BARS)
    expect(scoped.at(-1)).toBe(long.at(-1))
  })

  it('keeps a fib off a years-old extreme', () => {
    // The all-time high sits mid-series; the recent window must not reach it.
    const scoped = scopedCandles(long, undefined)
    const fib = fibonacciRetracement(scoped)!
    const windowHigh = Math.max(...scoped.map((c) => c.high))
    expect(Math.max(fib.from.price, fib.to.price)).toBe(windowHigh)
    expect(windowHigh).toBeLessThan(Math.max(...long.map((c) => c.high)))
  })

  it('honours a window the user did name', () => {
    const from = new Date((long[500]!.time - 1) * 1000).toISOString().slice(0, 10)
    expect(scopedCandles(long, { from }).length).toBeLessThan(DEFAULT_DRAWING_BARS)
  })

  it('widens rather than fitting a handful of bars', () => {
    const from = new Date((long.at(-3)!.time) * 1000).toISOString().slice(0, 10)
    expect(scopedCandles(long, { from })).toHaveLength(DEFAULT_DRAWING_BARS)
  })
})
