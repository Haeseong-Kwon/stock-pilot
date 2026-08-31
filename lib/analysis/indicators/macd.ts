import type { Series } from '@/lib/types'
import { ema } from './ema'

export type MacdResult = { macd: Series; signal: Series; histogram: Series }

export function macd(closes: Series, fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  if (fast >= slow) throw new Error('macd: fast period must be < slow period')
  const fastEma = ema(closes, fast)
  const slowEma = ema(closes, slow)
  const line: Series = closes.map((_, i) => {
    const f = fastEma[i]
    const s = slowEma[i]
    return f === null || f === undefined || s === null || s === undefined ? null : f - s
  })
  const signal = ema(line, signalPeriod)
  const histogram: Series = line.map((m, i) => {
    const s = signal[i]
    return m === null || s === null || s === undefined ? null : m - s
  })
  return { macd: line, signal, histogram }
}
