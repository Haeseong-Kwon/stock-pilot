import type { Series } from '@/lib/types'

/** Simple moving average over an arbitrary numeric series. */
export function sma(values: Series, period: number): Series {
  if (period <= 0) throw new Error('sma: period must be > 0')
  const out: Series = new Array(values.length).fill(null)
  let sum = 0
  let count = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v === null || v === undefined) {
      // A gap invalidates the running window; restart it.
      sum = 0
      count = 0
      continue
    }
    sum += v
    count++
    if (count > period) {
      const drop = values[i - period]
      sum -= drop ?? 0
      count = period
    }
    if (count === period) out[i] = sum / period
  }
  return out
}
