import type { Candle, Timeframe } from '@/lib/types'
import { MarketDataError, normalizeCandles, type MarketDataProvider } from '../provider'
import { searchCatalogue } from '../symbols'

const INTERVALS: Partial<Record<Timeframe, string>> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1D': '1d',
  '1W': '1w',
}

type Kline = [number, string, string, string, string, string, ...unknown[]]

export const binanceProvider: MarketDataProvider = {
  id: 'binance',
  supports: (timeframe) => INTERVALS[timeframe] !== undefined,
  searchSymbols: (query) => searchCatalogue(query).filter((s) => s.kind === 'crypto'),
  async getOHLCV({ symbol, timeframe }): Promise<Candle[]> {
    const interval = INTERVALS[timeframe]
    if (!interval) throw new MarketDataError(`Binance does not support ${timeframe}`, 400)
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
      symbol.toUpperCase(),
    )}&interval=${interval}&limit=1000`

    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (response.status === 400) throw new MarketDataError(`Unknown symbol ${symbol}`, 404)
    if (response.status === 429) throw new MarketDataError('Binance rate limit reached', 429)
    if (!response.ok) throw new MarketDataError(`Binance returned ${response.status}`)

    const payload: unknown = await response.json()
    if (!Array.isArray(payload)) throw new MarketDataError('Unexpected Binance payload')

    return normalizeCandles(
      (payload as Kline[]).map((k) => ({
        time: Math.floor(Number(k[0]) / 1000),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5]),
      })),
    )
  },
}
