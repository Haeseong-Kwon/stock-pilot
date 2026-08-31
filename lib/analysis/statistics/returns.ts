import type { Candle, Series } from '@/lib/types'

/** Fractional close-to-close return over `period` bars (0.05 === +5%). */
export function returns(closes: Series, period = 1): Series {
  const out: Series = new Array(closes.length).fill(null)
  for (let i = period; i < closes.length; i++) {
    const cur = closes[i]
    const prev = closes[i - period]
    if (cur === null || cur === undefined || prev === null || prev === undefined || prev === 0) continue
    out[i] = (cur - prev) / prev
  }
  return out
}

export function closesOf(candles: Candle[]): Series {
  return candles.map((c) => c.close)
}
