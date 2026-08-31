'use client'

import { useQuery } from '@tanstack/react-query'
import type { Timeframe } from '@/lib/types'
import type { CandleResponse } from '@/lib/market'

async function fetchCandles(symbol: string, timeframe: Timeframe): Promise<CandleResponse> {
  const response = await fetch(
    `/api/market/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
  )
  const payload: unknown = await response.json()
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status})`
    throw new Error(message)
  }
  return payload as CandleResponse
}

export function useCandles(symbol: string, timeframe: Timeframe) {
  return useQuery({
    queryKey: ['candles', symbol, timeframe],
    queryFn: () => fetchCandles(symbol, timeframe),
  })
}
