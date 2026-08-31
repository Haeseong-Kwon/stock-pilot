import type { Candle, Series } from '@/lib/types'
import { computeIndicator, indicatorSpec } from '@/lib/analysis/indicators/registry'
import type { IndicatorDef } from './indicators'
import { indicatorLabel, isOverlay } from './indicators'

export type LinePoint = { time: number; value: number }
export type PlottedLine = {
  key: string
  label: string
  color: string
  style: 'line' | 'histogram'
  data: LinePoint[]
}

export type IndicatorPlot = {
  def: IndicatorDef
  /** `price` overlays the candles, `volume` shares the volume scale, `own` gets a pane. */
  target: 'price' | 'volume' | 'own'
  lines: PlottedLine[]
  /** Reference lines drawn inside the indicator pane (e.g. RSI 30 / 70). */
  guides?: number[]
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

/** Dims a hex colour so band edges read as secondary. */
function shade(color: string, alpha: number): string {
  const hex = color.replace('#', '')
  const expanded = hex.length === 3 ? hex.replace(/(.)/g, '$1$1') : hex
  const num = Number.parseInt(expanded, 16)
  if (Number.isNaN(num)) return color
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`
}

export function buildIndicatorPlot(candles: Candle[], def: IndicatorDef): IndicatorPlot {
  const spec = indicatorSpec(def.type)
  const series = computeIndicator(def.type, candles, def.params)
  const label = indicatorLabel(def)

  const lines: PlottedLine[] = spec.outputs.map((output) => ({
    key: `${def.id}:${output.key}`,
    label: spec.outputs.length === 1 ? label : `${label} ${output.label}`,
    color: output.color ?? (output.muted ? shade(def.color, 0.5) : def.color),
    style: output.style ?? 'line',
    data: toPoints(candles, series[output.key] ?? []),
  }))

  return {
    def,
    target: spec.pane,
    lines,
    ...(spec.guides ? { guides: spec.guides } : {}),
  }
}

export function buildIndicatorPlots(candles: Candle[], indicators: IndicatorDef[]): IndicatorPlot[] {
  if (candles.length === 0) return []
  return indicators.map((def) => buildIndicatorPlot(candles, def))
}

export { isOverlay }
