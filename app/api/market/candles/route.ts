import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TIMEFRAMES } from '@/lib/types'
import { getCandles, MarketDataError } from '@/lib/market'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  symbol: z.string().min(1).max(20).regex(/^[A-Za-z0-9.\-^]+$/, 'Invalid symbol'),
  timeframe: z.enum(TIMEFRAMES),
})

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    symbol: url.searchParams.get('symbol') ?? '',
    timeframe: url.searchParams.get('timeframe') ?? '1D',
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  try {
    const data = await getCandles(parsed.data.symbol, parsed.data.timeframe)
    return NextResponse.json(data)
  } catch (error) {
    const status = error instanceof MarketDataError ? error.status : 502
    const message = error instanceof Error ? error.message : 'Market data unavailable'
    console.error('[api/market/candles]', message)
    return NextResponse.json({ error: message }, { status })
  }
}
