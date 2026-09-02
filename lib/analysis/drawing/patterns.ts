import type { Candle } from '@/lib/types'
import { pivotPoints, type Pivot } from './pivots'

export const PATTERN_KINDS = [
  'doubleTop',
  'doubleBottom',
  'headAndShoulders',
  'inverseHeadAndShoulders',
] as const
export type PatternKind = (typeof PATTERN_KINDS)[number]

export type ChartPattern = {
  kind: PatternKind
  /** The pivots that form the shape, in time order. */
  points: Array<{ time: number; price: number }>
  /** The level whose break completes the pattern. */
  neckline: number
  necklineFrom: number
  necklineTo: number
  /** True once price has closed through the neckline. */
  confirmed: boolean
  confirmedAt?: number
  /** Measured move: the pattern's own height projected past the neckline. */
  target: number
  /** `bearish` tops out, `bullish` bottoms out. */
  bias: 'bullish' | 'bearish'
}

type Options = {
  pivotWindow?: number
  /** How close two shoulders/peaks must be, as a fraction. */
  tolerance?: number
  /** How deep the trough between peaks must be, as a fraction. */
  minDepth?: number
  minBarsApart?: number
}

const close = (a: number, b: number, tolerance: number) =>
  Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) <= tolerance

/** The extreme pivot of the opposite kind that sits between two pivots. */
function between(pivots: Pivot[], a: Pivot, b: Pivot, kind: 'high' | 'low'): Pivot | null {
  const inner = pivots.filter((p) => p.kind === kind && p.index > a.index && p.index < b.index)
  if (inner.length === 0) return null
  return inner.reduce((best, p) =>
    kind === 'low' ? (p.price < best.price ? p : best) : p.price > best.price ? p : best,
  )
}

function confirmation(
  candles: Candle[],
  fromIndex: number,
  neckline: number,
  bias: 'bullish' | 'bearish',
): number | undefined {
  for (let i = fromIndex + 1; i < candles.length; i++) {
    const candle = candles[i]
    if (!candle) continue
    if (bias === 'bearish' ? candle.close < neckline : candle.close > neckline) return candle.time
  }
  return undefined
}

/**
 * Classic reversal shapes, found from the same pivots everything else is
 * anchored to. Each one reports whether price has actually completed it — an
 * unconfirmed double top is a shape, not a signal, and saying so is the point.
 */
export function findPatterns(candles: Candle[], options: Options = {}): ChartPattern[] {
  const { pivotWindow = 3, tolerance = 0.03, minDepth = 0.03, minBarsApart = 5 } = options
  if (candles.length < pivotWindow * 2 + 6) return []

  const pivots = pivotPoints(candles, pivotWindow)
  const highs = pivots.filter((p) => p.kind === 'high')
  const lows = pivots.filter((p) => p.kind === 'low')
  const found: ChartPattern[] = []

  const double = (
    group: Pivot[],
    kind: 'doubleTop' | 'doubleBottom',
    bias: 'bullish' | 'bearish',
  ) => {
    const opposite = bias === 'bearish' ? 'low' : 'high'
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        if (!a || !b || b.index - a.index < minBarsApart) continue
        if (!close(a.price, b.price, tolerance)) continue

        const middle = between(pivots, a, b, opposite)
        if (!middle) continue
        const depth = Math.abs(a.price - middle.price) / Math.abs(a.price)
        if (depth < minDepth) continue

        const neckline = middle.price
        const height = Math.abs(a.price - neckline)
        const confirmedAt = confirmation(candles, b.index, neckline, bias)
        found.push({
          kind,
          points: [a, middle, b].map((p) => ({ time: p.time, price: p.price })),
          neckline,
          necklineFrom: a.time,
          necklineTo: candles[candles.length - 1]?.time ?? b.time,
          confirmed: confirmedAt !== undefined,
          ...(confirmedAt !== undefined ? { confirmedAt } : {}),
          target: bias === 'bearish' ? neckline - height : neckline + height,
          bias,
        })
      }
    }
  }

  const shoulders = (
    group: Pivot[],
    kind: 'headAndShoulders' | 'inverseHeadAndShoulders',
    bias: 'bullish' | 'bearish',
  ) => {
    const opposite = bias === 'bearish' ? 'low' : 'high'
    const dominates = (head: number, shoulder: number) =>
      bias === 'bearish' ? head > shoulder * (1 + tolerance) : head < shoulder * (1 - tolerance)

    for (let i = 0; i < group.length - 2; i++) {
      for (let h = i + 1; h < group.length - 1; h++) {
        for (let r = h + 1; r < group.length; r++) {
          const left = group[i]
          const head = group[h]
          const right = group[r]
          if (!left || !head || !right) continue
          if (!dominates(head.price, left.price) || !dominates(head.price, right.price)) continue
          if (!close(left.price, right.price, tolerance)) continue

          const first = between(pivots, left, head, opposite)
          const second = between(pivots, head, right, opposite)
          if (!first || !second) continue

          const neckline = (first.price + second.price) / 2
          const height = Math.abs(head.price - neckline)
          const confirmedAt = confirmation(candles, right.index, neckline, bias)
          found.push({
            kind,
            points: [left, first, head, second, right].map((p) => ({ time: p.time, price: p.price })),
            neckline,
            necklineFrom: first.time,
            necklineTo: candles[candles.length - 1]?.time ?? right.time,
            confirmed: confirmedAt !== undefined,
            ...(confirmedAt !== undefined ? { confirmedAt } : {}),
            target: bias === 'bearish' ? neckline - height : neckline + height,
            bias,
          })
        }
      }
    }
  }

  double(highs, 'doubleTop', 'bearish')
  double(lows, 'doubleBottom', 'bullish')
  shoulders(highs, 'headAndShoulders', 'bearish')
  shoulders(lows, 'inverseHeadAndShoulders', 'bullish')

  return found
    .sort((a, b) => {
      // Completed shapes first — an unconfirmed double top is not a signal.
      if (a.confirmed !== b.confirmed) return a.confirmed ? -1 : 1
      // Then the more specific shape: a head and shoulders always contains a
      // double top between its shoulders, and reporting the coarser one loses
      // the head entirely.
      if (a.points.length !== b.points.length) return b.points.length - a.points.length
      return (b.points.at(-1)?.time ?? 0) - (a.points.at(-1)?.time ?? 0)
    })
    .filter((pattern, index, all) => {
      // One shape per ending pivot; the sort above decided which one that is.
      const lastTime = pattern.points.at(-1)?.time
      return all.findIndex((other) => other.points.at(-1)?.time === lastTime) === index
    })
}
