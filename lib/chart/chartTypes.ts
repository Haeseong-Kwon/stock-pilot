import type { Candle } from '@/lib/types'

export const CHART_TYPES = ['candles', 'hollow', 'bars', 'heikinAshi', 'line', 'area'] as const
export type ChartType = (typeof CHART_TYPES)[number]

export const CHART_TYPE_LABELS: Record<ChartType, { ko: string; en: string }> = {
  candles: { ko: '캔들', en: 'Candles' },
  hollow: { ko: '속 빈 캔들', en: 'Hollow candles' },
  bars: { ko: '바', en: 'Bars' },
  heikinAshi: { ko: '하이킨아시', en: 'Heikin Ashi' },
  line: { ko: '라인', en: 'Line' },
  area: { ko: '영역', en: 'Area' },
}

/** Chart types that draw one value per bar rather than a full OHLC glyph. */
export function isSingleValueType(type: ChartType): boolean {
  return type === 'line' || type === 'area'
}

/**
 * Heikin Ashi smooths each bar against the previous one, so trends read as
 * runs of one colour. The values are averages, not tradeable prices.
 *
 *   close = (O + H + L + C) / 4
 *   open  = (previous open + previous close) / 2
 *   high  = max(H, open, close)      low = min(L, open, close)
 */
export function heikinAshi(candles: Candle[]): Candle[] {
  const out: Candle[] = []
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]
    if (!candle) continue
    const close = (candle.open + candle.high + candle.low + candle.close) / 4
    const previous = out[i - 1]
    const open = previous ? (previous.open + previous.close) / 2 : (candle.open + candle.close) / 2
    out.push({
      time: candle.time,
      open,
      close,
      high: Math.max(candle.high, open, close),
      low: Math.min(candle.low, open, close),
      volume: candle.volume,
    })
  }
  return out
}

/** The candles a chart type actually draws. Only Heikin Ashi transforms them. */
export function candlesForType(candles: Candle[], type: ChartType): Candle[] {
  return type === 'heikinAshi' ? heikinAshi(candles) : candles
}

export const PRICE_SCALE_MODES = ['normal', 'logarithmic', 'percentage', 'indexedTo100'] as const
export type PriceScaleModeName = (typeof PRICE_SCALE_MODES)[number]

export const PRICE_SCALE_LABELS: Record<PriceScaleModeName, { ko: string; en: string }> = {
  normal: { ko: '일반', en: 'Normal' },
  logarithmic: { ko: '로그', en: 'Logarithmic' },
  percentage: { ko: '퍼센트', en: 'Percent' },
  indexedTo100: { ko: '100 기준', en: 'Indexed to 100' },
}
