import type { Candle } from '@/lib/types'

export const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const
export const FIB_EXTENSIONS = [1.272, 1.618] as const

export type FibonacciLevel = { ratio: number; price: number }

export type FibonacciRetracement = {
  /** `up` means the swing ran low -> high, so levels retrace downward. */
  direction: 'up' | 'down'
  from: { time: number; price: number }
  to: { time: number; price: number }
  levels: FibonacciLevel[]
}

/**
 * Anchors on the dominant swing in the window — the extreme low and extreme
 * high, ordered by which came first. Retracements are only meaningful against
 * a real swing, so this refuses rather than guessing when there isn't one.
 */
export function fibonacciRetracement(
  candles: Candle[],
  options: { extend?: boolean; minSwing?: number } = {},
): FibonacciRetracement | null {
  const { extend = false, minSwing = 0.03 } = options
  if (candles.length < 3) return null

  let highIndex = 0
  let lowIndex = 0
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]
    if (!candle) continue
    if (candle.high > (candles[highIndex]?.high ?? -Infinity)) highIndex = i
    if (candle.low < (candles[lowIndex]?.low ?? Infinity)) lowIndex = i
  }

  const high = candles[highIndex]
  const low = candles[lowIndex]
  if (!high || !low || highIndex === lowIndex) return null

  const span = high.high - low.low
  if (span <= 0 || span / low.low < minSwing) return null

  const direction: 'up' | 'down' = lowIndex < highIndex ? 'up' : 'down'
  const start = direction === 'up' ? low : high
  const end = direction === 'up' ? high : low
  const startPrice = direction === 'up' ? low.low : high.high
  const endPrice = direction === 'up' ? high.high : low.low

  const ratios = extend ? [...FIB_RATIOS, ...FIB_EXTENSIONS] : [...FIB_RATIOS]
  return {
    direction,
    from: { time: start.time, price: startPrice },
    to: { time: end.time, price: endPrice },
    // ratio 0 sits at the end of the swing, 1 back at its start.
    levels: ratios.map((ratio) => ({ ratio, price: endPrice - (endPrice - startPrice) * ratio })),
  }
}
