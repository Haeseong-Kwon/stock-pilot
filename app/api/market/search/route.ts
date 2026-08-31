import { NextResponse } from 'next/server'
import { searchCatalogue } from '@/lib/market/symbols'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') ?? ''
  return NextResponse.json({ results: searchCatalogue(query.slice(0, 20)) })
}
