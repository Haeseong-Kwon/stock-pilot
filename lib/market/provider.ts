import type { Candle, SymbolInfo, Timeframe } from '@/lib/types'

export type CandleRequest = { symbol: string; timeframe: Timeframe }

export type MarketDataProvider = {
  id: string
  /** Timeframes this provider can actually serve. */
  supports: (timeframe: Timeframe) => boolean
  getOHLCV: (request: CandleRequest) => Promise<Candle[]>
  searchSymbols: (query: string) => SymbolInfo[]
}

export class MarketDataError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message)
    this.name = 'MarketDataError'
  }
}

/** Drops malformed bars, dedupes timestamps, and sorts ascending. */
export function normalizeCandles(raw: Candle[]): Candle[] {
  const byTime = new Map<number, Candle>()
  for (const c of raw) {
    if (
      !Number.isFinite(c.time) ||
      !Number.isFinite(c.open) ||
      !Number.isFinite(c.high) ||
      !Number.isFinite(c.low) ||
      !Number.isFinite(c.close)
    ) {
      continue
    }
    byTime.set(c.time, { ...c, volume: Number.isFinite(c.volume) ? c.volume : 0 })
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time)
}
