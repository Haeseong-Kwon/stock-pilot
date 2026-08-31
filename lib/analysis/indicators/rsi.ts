import type { Series } from '@/lib/types'

/** Wilder's RSI. Returns values in [0, 100]. */
export function rsi(closes: Series, period = 14): Series {
  const out: Series = new Array(closes.length).fill(null)
  if (period <= 0) throw new Error('rsi: period must be > 0')
  let avgGain = 0
  let avgLoss = 0
  let seeded = 0
  for (let i = 1; i < closes.length; i++) {
    const cur = closes[i]
    const prev = closes[i - 1]
    if (cur === null || cur === undefined || prev === null || prev === undefined) continue
    const change = cur - prev
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0
    if (seeded < period) {
      avgGain += gain
      avgLoss += loss
      seeded++
      if (seeded === period) {
        avgGain /= period
        avgLoss /= period
        out[i] = toRsi(avgGain, avgLoss)
      }
      continue
    }
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out[i] = toRsi(avgGain, avgLoss)
  }
  return out
}

function toRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}
