import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCandles, MarketDataError } from '@/lib/market'
import { normalizeCandles } from '@/lib/market/provider'
import { isCryptoSymbol, searchCatalogue } from '@/lib/market/symbols'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

const klines = (n: number) =>
  Array.from({ length: n }, (_, i) => [
    (1_700_000_000 + i * 86400) * 1000,
    '100',
    '110',
    '90',
    '105',
    '1234',
  ])

function stub(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, ...response }) as typeof fetch
}

describe('normalizeCandles', () => {
  it('sorts, dedupes by timestamp and drops malformed bars', () => {
    const result = normalizeCandles([
      { time: 3, open: 1, high: 2, low: 0, close: 1, volume: 1 },
      { time: 1, open: 1, high: 2, low: 0, close: 1, volume: 1 },
      { time: 3, open: 9, high: 9, low: 9, close: 9, volume: 1 },
      { time: 2, open: Number.NaN, high: 2, low: 0, close: 1, volume: 1 },
    ])
    expect(result.map((c) => c.time)).toEqual([1, 3])
    expect(result[1]!.open).toBe(9)
  })

  it('defaults a missing volume to zero', () => {
    const [candle] = normalizeCandles([
      { time: 1, open: 1, high: 2, low: 0, close: 1, volume: Number.NaN },
    ])
    expect(candle!.volume).toBe(0)
  })
})

describe('symbol routing', () => {
  it('routes quote-suffixed pairs to the crypto provider', () => {
    expect(isCryptoSymbol('BTCUSDT')).toBe(true)
    expect(isCryptoSymbol('AAPL')).toBe(false)
  })

  it('searches on both ticker and company name', () => {
    expect(searchCatalogue('nvid').map((s) => s.symbol)).toContain('NVDA')
  })
})

describe('getCandles', () => {
  it('normalizes a provider payload', async () => {
    stub({ json: async () => klines(5) })
    const result = await getCandles('ETHUSDT', '1D')
    expect(result.provider).toBe('binance')
    expect(result.synthetic).toBe(false)
    expect(result.candles).toHaveLength(5)
    expect(result.candles[0]).toMatchObject({ open: 100, high: 110, low: 90, close: 105 })
    expect(result.supportedTimeframes).toContain('4h')
  })

  it('falls back to demo data when the provider is down', async () => {
    stub({ ok: false, status: 500, json: async () => ({}) })
    const result = await getCandles('SOLUSDT', '1D')
    expect(result.synthetic).toBe(true)
    expect(result.candles.length).toBeGreaterThan(100)
  })

  it('produces the same demo series every time', async () => {
    stub({ ok: false, status: 503, json: async () => ({}) })
    const a = await getCandles('LINKUSDT', '1h')
    stub({ ok: false, status: 503, json: async () => ({}) })
    const b = await getCandles('LINKUSDT', '4h')
    expect(a.candles.map((c) => c.close)).toEqual(b.candles.map((c) => c.close))
  })

  it('surfaces an unknown symbol instead of inventing data', async () => {
    stub({ ok: false, status: 400, json: async () => ({}) })
    await expect(getCandles('NOSUCHUSDT', '1D')).rejects.toBeInstanceOf(MarketDataError)
  })

  it('rejects a timeframe the equity provider cannot serve', async () => {
    await expect(getCandles('MSFT', '4h')).rejects.toMatchObject({ status: 400 })
  })

  it('serves a repeat request from cache without hitting the network', async () => {
    stub({ json: async () => klines(3) })
    await getCandles('XRPUSDT', '1W')
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    await getCandles('XRPUSDT', '1W')
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls)
  })
})
