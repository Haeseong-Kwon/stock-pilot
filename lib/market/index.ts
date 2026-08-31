import { TIMEFRAMES, type Candle, type Timeframe } from '@/lib/types'
import { MarketDataError, type MarketDataProvider } from './provider'
import { binanceProvider } from './providers/binance'
import { yahooProvider } from './providers/yahoo'
import { syntheticProvider } from './providers/synthetic'
import { isCryptoSymbol } from './symbols'

export type CandleResponse = {
  symbol: string
  timeframe: Timeframe
  provider: string
  /** True when live data was unavailable and demo data was substituted. */
  synthetic: boolean
  /** Timeframes this symbol's provider can serve — drives the toolbar. */
  supportedTimeframes: Timeframe[]
  candles: Candle[]
}

const TTL_MS = 60_000
const cache = new Map<string, { at: number; value: CandleResponse }>()

export function providerFor(symbol: string): MarketDataProvider {
  return isCryptoSymbol(symbol) ? binanceProvider : yahooProvider
}

export function supportedTimeframes(symbol: string): Timeframe[] {
  const provider = providerFor(symbol)
  return TIMEFRAMES.filter((t) => provider.supports(t))
}

/** Server-side fetch with a short TTL cache and a synthetic-data fallback. */
export async function getCandles(symbol: string, timeframe: Timeframe): Promise<CandleResponse> {
  const key = `${symbol.toUpperCase()}:${timeframe}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value

  const provider = providerFor(symbol)
  const supported = supportedTimeframes(symbol)
  let value: CandleResponse
  try {
    if (!provider.supports(timeframe)) {
      throw new MarketDataError(`${provider.id} does not serve ${timeframe} bars`, 400)
    }
    const candles = await provider.getOHLCV({ symbol, timeframe })
    if (candles.length === 0) throw new MarketDataError(`No bars returned for ${symbol}`, 404)
    value = {
      symbol: symbol.toUpperCase(),
      timeframe,
      provider: provider.id,
      synthetic: false,
      supportedTimeframes: supported,
      candles,
    }
  } catch (error) {
    if (error instanceof MarketDataError && (error.status === 404 || error.status === 400)) throw error
    console.error(`[market] ${provider.id} failed for ${key}:`, error)
    const candles = await syntheticProvider.getOHLCV({ symbol, timeframe })
    value = {
      symbol: symbol.toUpperCase(),
      timeframe,
      provider: 'synthetic',
      synthetic: true,
      supportedTimeframes: supported,
      candles,
    }
  }

  cache.set(key, { at: Date.now(), value })
  return value
}

export { MarketDataError }
