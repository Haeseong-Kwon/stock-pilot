/** Normalized OHLCV bar. `time` is a UTC epoch in seconds. */
export type Candle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'] as const
export type Timeframe = (typeof TIMEFRAMES)[number]

export type SymbolInfo = {
  symbol: string
  name: string
  kind: 'crypto' | 'stock'
}

/** A series aligned 1:1 with the candle array; `null` marks warm-up bars. */
export type Series = (number | null)[]
