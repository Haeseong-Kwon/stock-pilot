import type { SymbolInfo } from '@/lib/types'

/**
 * A curated catalogue for the search palette. Any other ticker can still be
 * typed in directly — this list only powers autocomplete.
 */
export const SYMBOL_CATALOGUE: SymbolInfo[] = [
  { symbol: 'BTCUSDT', name: 'Bitcoin / TetherUS', kind: 'crypto' },
  { symbol: 'ETHUSDT', name: 'Ethereum / TetherUS', kind: 'crypto' },
  { symbol: 'SOLUSDT', name: 'Solana / TetherUS', kind: 'crypto' },
  { symbol: 'XRPUSDT', name: 'XRP / TetherUS', kind: 'crypto' },
  { symbol: 'BNBUSDT', name: 'BNB / TetherUS', kind: 'crypto' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin / TetherUS', kind: 'crypto' },
  { symbol: 'ADAUSDT', name: 'Cardano / TetherUS', kind: 'crypto' },
  { symbol: 'AVAXUSDT', name: 'Avalanche / TetherUS', kind: 'crypto' },
  { symbol: 'LINKUSDT', name: 'Chainlink / TetherUS', kind: 'crypto' },
  { symbol: 'MATICUSDT', name: 'Polygon / TetherUS', kind: 'crypto' },
  { symbol: 'AAPL', name: 'Apple Inc.', kind: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', kind: 'stock' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', kind: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', kind: 'stock' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', kind: 'stock' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', kind: 'stock' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', kind: 'stock' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', kind: 'stock' },
  { symbol: 'NFLX', name: 'Netflix, Inc.', kind: 'stock' },
  { symbol: 'COIN', name: 'Coinbase Global, Inc.', kind: 'stock' },
  { symbol: 'PLTR', name: 'Palantir Technologies', kind: 'stock' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', kind: 'stock' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', kind: 'stock' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', kind: 'stock' },
  { symbol: 'BRK-B', name: 'Berkshire Hathaway Inc.', kind: 'stock' },
]

const CRYPTO_QUOTES = ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH']

export function isCryptoSymbol(symbol: string): boolean {
  const upper = symbol.toUpperCase()
  const known = SYMBOL_CATALOGUE.find((s) => s.symbol === upper)
  if (known) return known.kind === 'crypto'
  return CRYPTO_QUOTES.some((q) => upper.endsWith(q) && upper.length > q.length)
}

export function searchCatalogue(query: string, limit = 12): SymbolInfo[] {
  const q = query.trim().toUpperCase()
  if (!q) return SYMBOL_CATALOGUE.slice(0, limit)
  return SYMBOL_CATALOGUE.filter(
    (s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q),
  ).slice(0, limit)
}
