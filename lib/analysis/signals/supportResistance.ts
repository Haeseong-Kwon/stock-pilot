import type { Candle } from '@/lib/types'

export type Level = {
  price: number
  /** How many pivots landed in this cluster. */
  touches: number
  /** Normalized 0..1 against the strongest level found. */
  strength: number
  kind: 'support' | 'resistance'
}

type Options = {
  /** Bars either side that a pivot must dominate. */
  pivotWindow?: number
  /** Cluster width as a fraction of price. */
  tolerance?: number
  maxLevels?: number
}

function pivots(candles: Candle[], window: number) {
  const highs: number[] = []
  const lows: number[] = []
  for (let i = window; i < candles.length - window; i++) {
    const c = candles[i]
    if (!c) continue
    let isHigh = true
    let isLow = true
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue
      const other = candles[j]
      if (!other) continue
      if (other.high >= c.high) isHigh = false
      if (other.low <= c.low) isLow = false
    }
    if (isHigh) highs.push(c.high)
    if (isLow) lows.push(c.low)
  }
  return { highs, lows }
}

function cluster(prices: number[], tolerance: number, kind: Level['kind']): Level[] {
  const sorted = [...prices].sort((a, b) => a - b)
  const groups: number[][] = []
  for (const price of sorted) {
    const last = groups[groups.length - 1]
    const anchor = last?.[0]
    if (last && anchor !== undefined && Math.abs(price - anchor) / anchor <= tolerance) {
      last.push(price)
    } else {
      groups.push([price])
    }
  }
  return groups.map((group) => ({
    price: group.reduce((a, b) => a + b, 0) / group.length,
    touches: group.length,
    strength: 0,
    kind,
  }))
}

/**
 * Pivot clustering: find local extremes, group nearby ones, rank by touch count.
 * Deliberately simple — no ML, no regression fitting.
 */
export function findSupportResistance(candles: Candle[], options: Options = {}): Level[] {
  const { pivotWindow = 3, tolerance = 0.01, maxLevels = 6 } = options
  if (candles.length < pivotWindow * 2 + 2) return []
  const { highs, lows } = pivots(candles, pivotWindow)
  const last = candles[candles.length - 1]
  if (!last) return []

  const levels = [
    ...cluster(lows, tolerance, 'support'),
    ...cluster(highs, tolerance, 'resistance'),
  ].filter((l) => l.touches >= 2)

  const maxTouches = levels.reduce((m, l) => Math.max(m, l.touches), 0)
  if (maxTouches === 0) return []

  return levels
    .map((l) => ({
      ...l,
      strength: l.touches / maxTouches,
      // Levels are named by where they sit relative to the current price.
      kind: (l.price < last.close ? 'support' : 'resistance') as Level['kind'],
    }))
    .sort((a, b) => b.strength - a.strength || Math.abs(a.price - last.close) - Math.abs(b.price - last.close))
    .slice(0, maxLevels)
}
