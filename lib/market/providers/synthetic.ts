import type { Candle, Timeframe } from '@/lib/types'
import { normalizeCandles, type MarketDataProvider } from '../provider'
import { searchCatalogue } from '../symbols'

const BAR_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1D': 86400,
  '1W': 604800,
}

/** Mulberry32 — small, deterministic, good enough for demo data. */
function rng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Offline fallback: a seeded random walk with occasional shocks so the
 * analysis features have something to find. Same symbol always yields the
 * same series.
 */
export const syntheticProvider: MarketDataProvider = {
  id: 'synthetic',
  supports: () => true,
  searchSymbols: (query) => searchCatalogue(query),
  async getOHLCV({ symbol, timeframe }): Promise<Candle[]> {
    const random = rng(hash(symbol.toUpperCase()))
    const step = BAR_SECONDS[timeframe]
    const count = 900
    const end = Math.floor(Date.now() / 1000 / step) * step
    let price = 40 + random() * 260

    const candles: Candle[] = []
    for (let i = count - 1; i >= 0; i--) {
      const shock = random() < 0.02 ? (random() - 0.65) * 0.16 : 0
      const drift = (random() - 0.49) * 0.02
      const open = price
      const close = Math.max(1, open * (1 + drift + shock))
      const wick = Math.abs(close - open) + open * random() * 0.012
      candles.push({
        time: end - i * step,
        open,
        high: Math.max(open, close) + wick * random(),
        low: Math.min(open, close) - wick * random(),
        close,
        volume: Math.round((0.6 + random() * 0.8 + Math.abs(shock) * 14) * 1_000_000),
      })
      price = close
    }
    return normalizeCandles(candles)
  },
}
