import type { Candle } from '@/lib/types'

export type RegressionChannel = {
  from: { time: number; center: number; upper: number; lower: number }
  to: { time: number; center: number; upper: number; lower: number }
  /** Slope per bar, in price units. */
  slope: number
  /** 0..1 — how well the line explains the moves in the window. */
  fit: number
}

/**
 * Least-squares fit through the closes, with the channel width set by the
 * standard deviation of the residuals. This is the "draw a channel round the
 * trend" request, computed instead of eyeballed.
 */
export function regressionChannel(
  candles: Candle[],
  deviations = 2,
): RegressionChannel | null {
  const n = candles.length
  if (n < 3) return null

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    const close = candles[i]?.close ?? 0
    sumX += i
    sumY += close
    sumXY += i * close
    sumXX += i * i
  }

  const denominator = n * sumXX - sumX * sumX
  if (denominator === 0) return null
  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  let residual = 0
  let total = 0
  const mean = sumY / n
  for (let i = 0; i < n; i++) {
    const close = candles[i]?.close ?? 0
    residual += (close - (intercept + slope * i)) ** 2
    total += (close - mean) ** 2
  }
  const width = Math.sqrt(residual / n) * deviations

  const first = candles[0]
  const last = candles[n - 1]
  if (!first || !last) return null

  const at = (index: number) => intercept + slope * index
  return {
    from: { time: first.time, center: at(0), upper: at(0) + width, lower: at(0) - width },
    to: { time: last.time, center: at(n - 1), upper: at(n - 1) + width, lower: at(n - 1) - width },
    slope,
    fit: total === 0 ? 1 : Math.max(0, 1 - residual / total),
  }
}
