import type { Candle, Timeframe } from '@/lib/types'
import { MarketDataError, normalizeCandles, type MarketDataProvider } from '../provider'
import { searchCatalogue } from '../symbols'

/** interval + how much history to pull for it. */
const RANGES: Partial<Record<Timeframe, { interval: string; range: string }>> = {
  '1m': { interval: '1m', range: '7d' },
  '5m': { interval: '5m', range: '60d' },
  '15m': { interval: '15m', range: '60d' },
  '1h': { interval: '1h', range: '2y' },
  '1D': { interval: '1d', range: '5y' },
  '1W': { interval: '1wk', range: '10y' },
}

type ChartPayload = {
  chart?: {
    error?: { description?: string } | null
    result?: Array<{
      timestamp?: number[]
      indicators?: {
        quote?: Array<{
          open?: (number | null)[]
          high?: (number | null)[]
          low?: (number | null)[]
          close?: (number | null)[]
          volume?: (number | null)[]
        }>
      }
    }>
  }
}

export const yahooProvider: MarketDataProvider = {
  id: 'yahoo',
  supports: (timeframe) => RANGES[timeframe] !== undefined,
  searchSymbols: (query) => searchCatalogue(query).filter((s) => s.kind === 'stock'),
  async getOHLCV({ symbol, timeframe }): Promise<Candle[]> {
    const config = RANGES[timeframe]
    if (!config) throw new MarketDataError(`Equity data is not available at ${timeframe}`, 400)

    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol.toUpperCase())}` +
      `?interval=${config.interval}&range=${config.range}`

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChartPilot/0.1)' },
    })
    if (response.status === 404) throw new MarketDataError(`Unknown symbol ${symbol}`, 404)
    if (response.status === 429) throw new MarketDataError('Market data rate limit reached', 429)
    if (!response.ok) throw new MarketDataError(`Market data provider returned ${response.status}`)

    const payload = (await response.json()) as ChartPayload
    const result = payload.chart?.result?.[0]
    const quote = result?.indicators?.quote?.[0]
    const times = result?.timestamp
    if (!result || !quote || !times) {
      throw new MarketDataError(payload.chart?.error?.description ?? `No data for ${symbol}`, 404)
    }

    const candles: Candle[] = []
    for (let i = 0; i < times.length; i++) {
      const time = times[i]
      const open = quote.open?.[i]
      const high = quote.high?.[i]
      const low = quote.low?.[i]
      const close = quote.close?.[i]
      if (
        time === undefined ||
        open === null || open === undefined ||
        high === null || high === undefined ||
        low === null || low === undefined ||
        close === null || close === undefined
      ) {
        continue
      }
      candles.push({ time, open, high, low, close, volume: quote.volume?.[i] ?? 0 })
    }
    return normalizeCandles(candles)
  },
}
