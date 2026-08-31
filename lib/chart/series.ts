import type { Candle, Series } from '@/lib/types'
import { atr, bollinger, ema, macd, rsi, sma } from '@/lib/analysis/indicators'
import { volatility } from '@/lib/analysis/statistics/volatility'
import type { IndicatorDef } from './indicators'
import { indicatorLabel, isOverlay } from './indicators'

export type LinePoint = { time: number; value: number }
export type PlottedLine = { key: string; label: string; color: string; data: LinePoint[] }

export type IndicatorPlot = {
  def: IndicatorDef
  /** `price` overlays the candles, `volume` shares the volume scale, `own` gets a pane. */
  target: 'price' | 'volume' | 'own'
  lines: PlottedLine[]
  histogram?: PlottedLine
  /** Reference lines drawn inside the indicator pane (e.g. RSI 30 / 70). */
  guides?: number[]
  /** Fixed pane scale, when the indicator has a natural range. */
  bounds?: { min: number; max: number }
}

function toPoints(candles: Candle[], values: Series): LinePoint[] {
  const out: LinePoint[] = []
  for (let i = 0; i < candles.length; i++) {
    const value = values[i]
    const candle = candles[i]
    if (value === null || value === undefined || !candle || !Number.isFinite(value)) continue
    out.push({ time: candle.time, value })
  }
  return out
}

const shade = (color: string, alpha: number) => {
  const hex = color.replace('#', '')
  const num = Number.parseInt(hex.length === 3 ? hex.replace(/(.)/g, '$1$1') : hex, 16)
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`
}

export function buildIndicatorPlot(candles: Candle[], def: IndicatorDef): IndicatorPlot {
  const closes = candles.map((c) => c.close)
  const p = def.params
  const label = indicatorLabel(def)

  switch (def.type) {
    case 'SMA':
      return {
        def,
        target: 'price',
        lines: [{ key: def.id, label, color: def.color, data: toPoints(candles, sma(sourceOf(candles, def), p.period ?? 20)) }],
      }
    case 'EMA':
      return {
        def,
        target: 'price',
        lines: [{ key: def.id, label, color: def.color, data: toPoints(candles, ema(sourceOf(candles, def), p.period ?? 20)) }],
      }
    case 'BOLLINGER': {
      const bands = bollinger(closes, p.period ?? 20, p.stdDev ?? 2)
      return {
        def,
        target: 'price',
        lines: [
          { key: `${def.id}:u`, label: `${label} upper`, color: shade(def.color, 0.85), data: toPoints(candles, bands.upper) },
          { key: `${def.id}:m`, label: `${label} basis`, color: shade(def.color, 0.45), data: toPoints(candles, bands.middle) },
          { key: `${def.id}:l`, label: `${label} lower`, color: shade(def.color, 0.85), data: toPoints(candles, bands.lower) },
        ],
      }
    }
    case 'VOLUME_SMA':
      return {
        def,
        target: 'volume',
        lines: [
          {
            key: def.id,
            label,
            color: def.color,
            data: toPoints(candles, sma(candles.map((c) => c.volume), p.period ?? 20)),
          },
        ],
      }
    case 'RSI':
      return {
        def,
        target: 'own',
        lines: [{ key: def.id, label, color: def.color, data: toPoints(candles, rsi(closes, p.period ?? 14)) }],
        guides: [30, 70],
        bounds: { min: 0, max: 100 },
      }
    case 'MACD': {
      const result = macd(closes, p.fast ?? 12, p.slow ?? 26, p.signal ?? 9)
      return {
        def,
        target: 'own',
        lines: [
          { key: `${def.id}:macd`, label: `${label} MACD`, color: def.color, data: toPoints(candles, result.macd) },
          { key: `${def.id}:signal`, label: `${label} signal`, color: '#f0b429', data: toPoints(candles, result.signal) },
        ],
        histogram: {
          key: `${def.id}:hist`,
          label: `${label} histogram`,
          color: def.color,
          data: toPoints(candles, result.histogram),
        },
        guides: [0],
      }
    }
    case 'ATR':
      return {
        def,
        target: 'own',
        lines: [{ key: def.id, label, color: def.color, data: toPoints(candles, atr(candles, p.period ?? 14)) }],
      }
    case 'VOLATILITY':
      return {
        def,
        target: 'own',
        lines: [
          {
            key: def.id,
            label,
            color: def.color,
            data: toPoints(candles, volatility(closes, p.period ?? 20)),
          },
        ],
      }
  }
}

function sourceOf(candles: Candle[], def: IndicatorDef): Series {
  switch (def.params.source) {
    case 'OPEN':
      return candles.map((c) => c.open)
    case 'HIGH':
      return candles.map((c) => c.high)
    case 'LOW':
      return candles.map((c) => c.low)
    case 'VOLUME':
      return candles.map((c) => c.volume)
    default:
      return candles.map((c) => c.close)
  }
}

export function buildIndicatorPlots(candles: Candle[], indicators: IndicatorDef[]): IndicatorPlot[] {
  if (candles.length === 0) return []
  return indicators.map((def) => buildIndicatorPlot(candles, def))
}

export { isOverlay }
