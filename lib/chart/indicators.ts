import type { IndicatorParams, IndicatorType } from '@/lib/schemas/chartCommand'
import { indicatorSpec, resolveParams } from '@/lib/analysis/indicators/registry'

export type IndicatorDef = {
  id: string
  type: IndicatorType
  params: IndicatorParams
  color: string
}

const PALETTE = ['#4a9eff', '#f0b429', '#a78bfa', '#34d399', '#fb7185', '#22d3ee', '#f97316']

export function isOverlay(type: IndicatorType): boolean {
  return indicatorSpec(type).pane !== 'own'
}

function paramKey(type: IndicatorType, params: IndicatorParams): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
  return `${type}:${parts.join(',')}`
}

/** Applies the registry defaults and derives a stable id, so adds are idempotent. */
export function normalizeIndicator(
  type: IndicatorType,
  params: IndicatorParams | undefined,
  existingCount = 0,
): IndicatorDef {
  const resolved = resolveParams(type, params ?? {}) as IndicatorParams
  const merged: IndicatorParams = params?.source ? { ...resolved, source: params.source } : resolved
  return {
    id: paramKey(type, merged),
    type,
    params: merged,
    color: PALETTE[existingCount % PALETTE.length] as string,
  }
}

/** "SMA 20", "MACD 12/26/9", "Ichimoku 9/26/52" — short enough for a badge. */
export function indicatorLabel(def: IndicatorDef): string {
  const spec = indicatorSpec(def.type)
  const values = spec.params.map((param) => def.params[param.key] ?? param.default)
  return values.length === 0 ? spec.short : `${spec.short} ${values.join('/')}`
}
