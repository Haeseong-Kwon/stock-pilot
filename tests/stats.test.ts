import { describe, expect, it } from 'vitest'
import type { Candle } from '@/lib/types'
import { symbolStats } from '@/lib/chart/stats'
import { WorkspaceSchema } from '@/lib/chart/workspace'

const DAY = 86400
const START = Date.UTC(2024, 0, 1) / 1000

const bars = (rows: Array<[number, number, number, number, number]>): Candle[] =>
  rows.map(([open, high, low, close, volume], i) => ({
    time: START + i * DAY,
    open,
    high,
    low,
    close,
    volume,
  }))

describe('symbolStats', () => {
  const candles = bars([
    [10, 12, 8, 10, 100],
    [10, 20, 9, 18, 300],
    [18, 19, 15, 16, 200],
  ])

  it('reports the change against the previous close', () => {
    const stats = symbolStats(candles)!
    expect(stats.last).toBe(16)
    expect(stats.change).toBe(-2)
    expect(stats.changePercent).toBeCloseTo(-2 / 18, 10)
  })

  it('reports the period extremes and where price sits in them', () => {
    const stats = symbolStats(candles)!
    expect(stats.periodHigh).toBe(20)
    expect(stats.periodLow).toBe(8)
    expect(stats.periodPosition).toBeCloseTo((16 - 8) / 12, 10)
  })

  it('compares the last volume against the window average', () => {
    const stats = symbolStats(candles)!
    expect(stats.averageVolume).toBeCloseTo(200, 10)
    expect(stats.volumeRatio).toBeCloseTo(1, 10)
  })

  it('honours the lookback window', () => {
    expect(symbolStats(candles, 1)!.periodHigh).toBe(19)
  })

  it('is null with no candles and safe with one', () => {
    expect(symbolStats([])).toBeNull()
    const single = symbolStats(bars([[10, 12, 8, 10, 100]]))!
    expect(single.change).toBe(0)
    expect(single.changePercent).toBe(0)
  })

  it('does not divide by zero on a flat range', () => {
    const flat = symbolStats(bars([[5, 5, 5, 5, 0], [5, 5, 5, 5, 0]]))!
    expect(flat.periodPosition).toBe(0.5)
    expect(flat.volumeRatio).toBe(0)
  })
})

describe('workspace schema', () => {
  const valid = {
    version: 1,
    symbol: 'BTCUSDT',
    timeframe: '1D',
    chartType: 'candles',
    priceScaleMode: 'normal',
    indicators: [{ type: 'RSI', params: { period: 14 } }],
    signals: [
      {
        name: 'Drop',
        condition: { type: 'COMPARE', left: { type: 'CLOSE' }, operator: '<', right: 1 },
        color: '#ef4444',
        position: 'belowBar',
        shape: 'circle',
      },
    ],
    recentSymbols: ['AAPL'],
  }

  it('accepts a well-formed workspace', () => {
    expect(WorkspaceSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a stale version rather than half-restoring', () => {
    expect(WorkspaceSchema.safeParse({ ...valid, version: 0 }).success).toBe(false)
  })

  it('rejects an indicator that no longer exists', () => {
    expect(
      WorkspaceSchema.safeParse({ ...valid, indicators: [{ type: 'GONE', params: {} }] }).success,
    ).toBe(false)
  })

  it('rejects a condition the evaluator could not run', () => {
    expect(
      WorkspaceSchema.safeParse({
        ...valid,
        signals: [{ ...valid.signals[0], condition: { type: 'NONSENSE' } }],
      }).success,
    ).toBe(false)
  })

  it('rejects an unusable chart type or scale', () => {
    expect(WorkspaceSchema.safeParse({ ...valid, chartType: 'renko' }).success).toBe(false)
    expect(WorkspaceSchema.safeParse({ ...valid, priceScaleMode: 'inverted' }).success).toBe(false)
  })
})
