import { describe, expect, it } from 'vitest'
import type { Candle } from '@/lib/types'
import { CHART_TYPES, candlesForType, heikinAshi, isSingleValueType } from '@/lib/chart/chartTypes'
import { RANGE_PRESETS, availableRanges, rangeFor } from '@/lib/chart/ranges'

const DAY = 86400
const START = Date.UTC(2024, 0, 1) / 1000

const make = (rows: Array<[number, number, number, number]>): Candle[] =>
  rows.map(([open, high, low, close], i) => ({
    time: START + i * DAY,
    open,
    high,
    low,
    close,
    volume: 1000,
  }))

describe('heikinAshi', () => {
  const source = make([
    [10, 14, 9, 13],
    [13, 18, 12, 17],
  ])

  it('averages the bar into its close', () => {
    // (10 + 14 + 9 + 13) / 4 = 11.5
    expect(heikinAshi(source)[0]?.close).toBeCloseTo(11.5, 10)
  })

  it('seeds the first open from the bar itself', () => {
    expect(heikinAshi(source)[0]?.open).toBeCloseTo(11.5, 10) // (10 + 13) / 2
  })

  it('carries the previous HA bar into the next open', () => {
    const [first, second] = heikinAshi(source)
    expect(second?.open).toBeCloseTo(((first?.open ?? 0) + (first?.close ?? 0)) / 2, 10)
  })

  it('keeps high >= open/close and low <= open/close', () => {
    for (const bar of heikinAshi(make([[10, 11, 5, 6], [6, 20, 6, 19], [19, 19, 2, 3]]))) {
      expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close))
      expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close))
    }
  })

  it('preserves timestamps, volume and length', () => {
    const result = heikinAshi(source)
    expect(result).toHaveLength(source.length)
    expect(result.map((c) => c.time)).toEqual(source.map((c) => c.time))
    expect(result.map((c) => c.volume)).toEqual(source.map((c) => c.volume))
  })

  it('does not mutate the input', () => {
    const copy = JSON.parse(JSON.stringify(source))
    heikinAshi(source)
    expect(source).toEqual(copy)
  })

  it('handles an empty series', () => {
    expect(heikinAshi([])).toEqual([])
  })
})

describe('candlesForType', () => {
  const source = make([[10, 14, 9, 13]])

  it('only transforms for Heikin Ashi', () => {
    for (const type of CHART_TYPES) {
      const result = candlesForType(source, type)
      if (type === 'heikinAshi') expect(result).not.toEqual(source)
      else expect(result).toBe(source)
    }
  })

  it('knows which types draw a single value', () => {
    expect(isSingleValueType('line')).toBe(true)
    expect(isSingleValueType('area')).toBe(true)
    expect(isSingleValueType('candles')).toBe(false)
  })
})

describe('range presets', () => {
  const twoYears = Array.from({ length: 730 }, (_, i) => ({
    time: Date.UTC(2024, 0, 1) / 1000 + i * DAY,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 1,
  }))

  it('ALL means fit everything', () => {
    expect(rangeFor('ALL', twoYears)).toBeNull()
  })

  it('measures back from the last bar', () => {
    const range = rangeFor('1M', twoYears)
    const last = twoYears.at(-1)!.time
    expect(range?.to).toBe(last)
    expect(range?.from).toBe(last - 30 * DAY)
  })

  it('never starts before the data does', () => {
    const range = rangeFor('5Y', twoYears)
    expect(range?.from).toBe(twoYears[0]!.time)
  })

  it('YTD starts on 1 January of the last bar year', () => {
    const range = rangeFor('YTD', twoYears)
    expect(range?.from).toBe(Date.UTC(2025, 0, 1) / 1000)
  })

  it('returns null when there are no candles', () => {
    for (const preset of RANGE_PRESETS) expect(rangeFor(preset, [])).toBeNull()
  })

  it('hides presets the loaded history cannot fill', () => {
    const oneMonth = twoYears.slice(0, 30)
    expect(availableRanges(oneMonth)).not.toContain('5Y')
    expect(availableRanges(oneMonth)).toContain('ALL')
    expect(availableRanges(twoYears)).toContain('1Y')
    expect(availableRanges([])).toEqual(['ALL'])
  })
})
