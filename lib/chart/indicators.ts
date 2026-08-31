import type { IndicatorParams, IndicatorType } from '@/lib/schemas/chartCommand'

export type IndicatorDef = {
  id: string
  type: IndicatorType
  params: Required<Pick<IndicatorParams, never>> & IndicatorParams
  color: string
}

const DEFAULTS: Record<IndicatorType, IndicatorParams> = {
  SMA: { period: 20, source: 'CLOSE' },
  EMA: { period: 20, source: 'CLOSE' },
  RSI: { period: 14 },
  MACD: { fast: 12, slow: 26, signal: 9 },
  BOLLINGER: { period: 20, stdDev: 2 },
  ATR: { period: 14 },
  VOLUME_SMA: { period: 20 },
}

const PALETTE = ['#4a9eff', '#f0b429', '#a78bfa', '#34d399', '#fb7185', '#22d3ee', '#f97316']

export const OVERLAY_INDICATORS: IndicatorType[] = ['SMA', 'EMA', 'BOLLINGER', 'VOLUME_SMA']

export function isOverlay(type: IndicatorType): boolean {
  return OVERLAY_INDICATORS.includes(type)
}

function paramKey(type: IndicatorType, params: IndicatorParams): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
  return `${type}:${parts.join(',')}`
}

/** Applies per-type defaults and derives a stable id, so adds are idempotent. */
export function normalizeIndicator(
  type: IndicatorType,
  params: IndicatorParams | undefined,
  existingCount = 0,
): IndicatorDef {
  const merged: IndicatorParams = { ...DEFAULTS[type], ...stripUndefined(params ?? {}) }
  return {
    id: paramKey(type, merged),
    type,
    params: merged,
    color: PALETTE[existingCount % PALETTE.length] as string,
  }
}

function stripUndefined(params: IndicatorParams): IndicatorParams {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
}

export function indicatorLabel(def: IndicatorDef): string {
  const p = def.params
  switch (def.type) {
    case 'MACD':
      return `MACD ${p.fast}/${p.slow}/${p.signal}`
    case 'BOLLINGER':
      return `BB ${p.period}, ${p.stdDev}σ`
    case 'VOLUME_SMA':
      return `Vol SMA ${p.period}`
    default:
      return `${def.type} ${p.period}`
  }
}
