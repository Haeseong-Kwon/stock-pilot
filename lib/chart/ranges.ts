import type { Candle } from '@/lib/types'

export const RANGE_PRESETS = ['1M', '3M', '6M', 'YTD', '1Y', '5Y', 'ALL'] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]

const SECONDS: Partial<Record<RangePreset, number>> = {
  '1M': 30 * 86400,
  '3M': 91 * 86400,
  '6M': 182 * 86400,
  '1Y': 365 * 86400,
  '5Y': 5 * 365 * 86400,
}

/**
 * The window a preset covers, clamped to the data actually loaded. Returns null
 * for ALL, meaning "fit everything", and when there are no candles.
 */
export function rangeFor(
  preset: RangePreset,
  candles: Candle[],
  now = Date.now(),
): { from: number; to: number } | null {
  const first = candles[0]
  const last = candles[candles.length - 1]
  if (!first || !last || preset === 'ALL') return null

  const to = last.time
  if (preset === 'YTD') {
    const year = new Date(Math.min(to * 1000, now)).getUTCFullYear()
    const start = Date.UTC(year, 0, 1) / 1000
    return { from: Math.max(start, first.time), to }
  }

  const span = SECONDS[preset]
  if (span === undefined) return null
  return { from: Math.max(to - span, first.time), to }
}

/** Presets that the loaded history is long enough to show meaningfully. */
export function availableRanges(candles: Candle[]): RangePreset[] {
  const first = candles[0]
  const last = candles[candles.length - 1]
  if (!first || !last) return ['ALL']
  const span = last.time - first.time
  return RANGE_PRESETS.filter((preset) => {
    if (preset === 'ALL' || preset === 'YTD') return true
    const needed = SECONDS[preset]
    // Offer a preset once the data covers at least a third of it.
    return needed === undefined || span >= needed / 3
  })
}
