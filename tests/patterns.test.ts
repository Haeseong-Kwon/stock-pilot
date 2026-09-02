import { describe, expect, it } from 'vitest'
import type { Candle } from '@/lib/types'
import { findPatterns } from '@/lib/analysis/drawing'

const DAY = 86400
const START = Date.UTC(2024, 0, 1) / 1000

/** Builds bars from a close path; highs/lows hug the close so pivots are exact. */
const path = (closes: number[]): Candle[] =>
  closes.map((close, i) => ({
    time: START + i * DAY,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  }))

/** A zig-zag through the given turning points, interpolated between them. */
function zigzag(points: number[], step = 4): number[] {
  const out: number[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i] as number
    const to = points[i + 1] as number
    for (let s = 0; s < step; s++) out.push(from + ((to - from) * s) / step)
  }
  out.push(points.at(-1) as number)
  return out
}

describe('double top', () => {
  // 100 up to 130, back to 110, up to 130 again, then break below 110.
  const candles = path(zigzag([100, 130, 110, 130, 100]))

  it('finds the shape and names both peaks and the trough', () => {
    const pattern = findPatterns(candles, { pivotWindow: 2 }).find((p) => p.kind === 'doubleTop')
    expect(pattern).toBeDefined()
    expect(pattern!.points).toHaveLength(3)
    expect(pattern!.points[0]!.price).toBeCloseTo(130, 6)
    expect(pattern!.points[1]!.price).toBeCloseTo(110, 6)
    expect(pattern!.points[2]!.price).toBeCloseTo(130, 6)
  })

  it('puts the neckline on the trough and projects the measured move', () => {
    const pattern = findPatterns(candles, { pivotWindow: 2 }).find((p) => p.kind === 'doubleTop')!
    expect(pattern.neckline).toBeCloseTo(110, 6)
    expect(pattern.target).toBeCloseTo(90, 6) // 110 - (130 - 110)
    expect(pattern.bias).toBe('bearish')
  })

  it('marks it confirmed once price closes through the neckline', () => {
    const pattern = findPatterns(candles, { pivotWindow: 2 }).find((p) => p.kind === 'doubleTop')!
    expect(pattern.confirmed).toBe(true)
    expect(pattern.confirmedAt).toBeGreaterThan(pattern.points[2]!.time)
  })

  it('reports an unconfirmed shape as unconfirmed rather than hiding it', () => {
    // Same two peaks, but price never breaks the trough afterwards.
    const pending = path(zigzag([100, 130, 110, 130, 125]))
    const pattern = findPatterns(pending, { pivotWindow: 2 }).find((p) => p.kind === 'doubleTop')
    expect(pattern?.confirmed).toBe(false)
    expect(pattern?.confirmedAt).toBeUndefined()
  })

  it('rejects two peaks at clearly different prices', () => {
    const uneven = path(zigzag([100, 130, 110, 165, 100]))
    expect(findPatterns(uneven, { pivotWindow: 2, tolerance: 0.03 }).some((p) => p.kind === 'doubleTop'))
      .toBe(false)
  })

  it('rejects a trough too shallow to separate the peaks', () => {
    const shallow = path(zigzag([100, 130, 129, 130, 100]))
    expect(findPatterns(shallow, { pivotWindow: 2, minDepth: 0.03 }).some((p) => p.kind === 'doubleTop'))
      .toBe(false)
  })
})

describe('double bottom', () => {
  const candles = path(zigzag([130, 100, 120, 100, 130]))

  it('mirrors the double top', () => {
    const pattern = findPatterns(candles, { pivotWindow: 2 }).find((p) => p.kind === 'doubleBottom')!
    expect(pattern.bias).toBe('bullish')
    expect(pattern.neckline).toBeCloseTo(120, 6)
    expect(pattern.target).toBeCloseTo(140, 6) // 120 + (120 - 100)
    expect(pattern.confirmed).toBe(true)
  })
})

describe('head and shoulders', () => {
  // Shoulder 120, head 150, shoulder 120, with troughs at 100.
  const candles = path(zigzag([90, 120, 100, 150, 100, 120, 85]))

  it('finds five points with the head above both shoulders', () => {
    const pattern = findPatterns(candles, { pivotWindow: 2 })
      .find((p) => p.kind === 'headAndShoulders')
    expect(pattern).toBeDefined()
    expect(pattern!.points).toHaveLength(5)
    const [left, , head, , right] = pattern!.points
    expect(head!.price).toBeGreaterThan(left!.price)
    expect(head!.price).toBeGreaterThan(right!.price)
    expect(left!.price).toBeCloseTo(right!.price, 6)
  })

  it('draws the neckline through the two troughs and projects the head height', () => {
    const pattern = findPatterns(candles, { pivotWindow: 2 })
      .find((p) => p.kind === 'headAndShoulders')!
    expect(pattern.neckline).toBeCloseTo(100, 6)
    expect(pattern.target).toBeCloseTo(50, 6) // 100 - (150 - 100)
    expect(pattern.confirmed).toBe(true)
  })

  it('finds the inverse shape on a bottoming market', () => {
    const inverse = path(zigzag([160, 130, 150, 100, 150, 130, 165]))
    const pattern = findPatterns(inverse, { pivotWindow: 2 })
      .find((p) => p.kind === 'inverseHeadAndShoulders')
    expect(pattern?.bias).toBe('bullish')
    expect(pattern?.confirmed).toBe(true)
  })

  it('rejects a head that does not clear the shoulders', () => {
    const flat = path(zigzag([90, 120, 100, 122, 100, 120, 85]))
    expect(findPatterns(flat, { pivotWindow: 2, tolerance: 0.03 })
      .some((p) => p.kind === 'headAndShoulders')).toBe(false)
  })
})

describe('pattern ranking and safety', () => {
  it('puts confirmed shapes first', () => {
    const candles = path(zigzag([100, 130, 110, 130, 100, 125, 108, 125, 122]))
    const patterns = findPatterns(candles, { pivotWindow: 2 })
    const firstUnconfirmed = patterns.findIndex((p) => !p.confirmed)
    if (firstUnconfirmed !== -1) {
      expect(patterns.slice(firstUnconfirmed).every((p) => !p.confirmed)).toBe(true)
    }
  })

  it('anchors every point on a real bar', () => {
    const candles = path(zigzag([100, 130, 110, 130, 100]))
    const times = new Set(candles.map((c) => c.time))
    for (const pattern of findPatterns(candles, { pivotWindow: 2 })) {
      for (const point of pattern.points) expect(times.has(point.time)).toBe(true)
    }
  })

  it('finds nothing rather than inventing a shape', () => {
    expect(findPatterns(path([1, 2, 3]))).toEqual([])
    expect(findPatterns([])).toEqual([])
    expect(findPatterns(path(new Array(60).fill(100)), { pivotWindow: 2 })).toEqual([])
  })
})

describe('overlapping shapes', () => {
  it('keeps the head and shoulders over the double top hidden inside it', () => {
    // The two shoulders alone also form a double top ending on the same pivot.
    const candles = path(zigzag([90, 120, 100, 150, 100, 120, 85]))
    const patterns = findPatterns(candles, { pivotWindow: 2 })
    const endings = patterns.map((p) => p.points.at(-1)?.time)
    expect(new Set(endings).size).toBe(endings.length)
    expect(patterns.some((p) => p.kind === 'headAndShoulders')).toBe(true)
  })
})
