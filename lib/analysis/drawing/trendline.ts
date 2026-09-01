import type { Candle } from '@/lib/types'
import { pivotPoints, type Pivot } from './pivots'

export type Trendline = {
  kind: 'support' | 'resistance'
  from: { time: number; price: number }
  to: { time: number; price: number }
  /** Pivots the line actually passes through, within tolerance. */
  touches: number
  /** Bars covered from the first anchor to the last candle. */
  span: number
  /**
   * When price broke through after the line was established, if it has. Drawing
   * an extended line without saying it was already breached is misleading, and
   * the break itself is usually the interesting part.
   */
  brokenAt?: number
}

type Options = {
  pivotWindow?: number
  /** How close a pivot must sit to count as a touch, as a fraction of price. */
  tolerance?: number
  maxLines?: number
}

const priceAt = (a: Pivot, b: Pivot, index: number): number =>
  a.price + ((b.price - a.price) / (b.index - a.index)) * (index - a.index)

/**
 * Fits trend lines the way a chartist draws them: pick two pivots, keep the line
 * only if price never breaks through it between them, then score by how many
 * other pivots it touches. The line is extended to the last bar.
 */
export function findTrendlines(candles: Candle[], options: Options = {}): Trendline[] {
  const { pivotWindow = 3, tolerance = 0.005, maxLines = 2 } = options
  const last = candles[candles.length - 1]
  if (!last || candles.length < pivotWindow * 2 + 3) return []

  const pivots = pivotPoints(candles, pivotWindow)
  const results: Trendline[] = []

  for (const kind of ['resistance', 'support'] as const) {
    const wanted = kind === 'resistance' ? 'high' : 'low'
    const group = pivots.filter((p) => p.kind === wanted)
    let best: Trendline | null = null
    let bestScore = -1

    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) {
        const first = group[a]
        const second = group[b]
        if (!first || !second || second.index === first.index) continue

        // The line may not be broken by price between its own anchors.
        let valid = true
        for (let i = first.index; i <= second.index && valid; i++) {
          const candle = candles[i]
          if (!candle) continue
          const line = priceAt(first, second, i)
          const slack = Math.abs(line) * tolerance
          if (kind === 'resistance' ? candle.high > line + slack : candle.low < line - slack) {
            valid = false
          }
        }
        if (!valid) continue

        let touches = 0
        for (const pivot of group) {
          const line = priceAt(first, second, pivot.index)
          if (Math.abs(pivot.price - line) <= Math.abs(line) * tolerance) touches++
        }
        if (touches < 2) continue

        // Beyond the anchors the line is a projection: record where price first
        // broke it rather than pretending it still holds.
        let brokenAt: number | undefined
        for (let i = second.index + 1; i < candles.length; i++) {
          const candle = candles[i]
          if (!candle) continue
          const line = priceAt(first, second, i)
          const slack = Math.abs(line) * tolerance
          if (kind === 'resistance' ? candle.high > line + slack : candle.low < line - slack) {
            brokenAt = candle.time
            break
          }
        }

        // A line that still holds beats a longer one that has been breached.
        const span = second.index - first.index
        const score = (brokenAt === undefined ? 1_000_000 : 0) + touches * 1000 + span
        if (score > bestScore) {
          bestScore = score
          best = {
            kind,
            from: { time: first.time, price: first.price },
            to: { time: last.time, price: priceAt(first, second, candles.length - 1) },
            touches,
            span: candles.length - 1 - first.index,
            ...(brokenAt !== undefined ? { brokenAt } : {}),
          }
        }
      }
    }
    if (best) results.push(best)
  }

  return results.sort((x, y) => y.touches - x.touches).slice(0, maxLines)
}
