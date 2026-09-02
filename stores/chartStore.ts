'use client'

import { create } from 'zustand'
import type { Timeframe } from '@/lib/types'
import type { Condition } from '@/lib/schemas/expression'
import type { IndicatorParams, IndicatorType } from '@/lib/schemas/chartCommand'
import type { Level } from '@/lib/analysis/signals'
import type {
  ChartPattern,
  FibonacciRetracement,
  RegressionChannel,
  Trendline,
} from '@/lib/analysis/drawing'
import { normalizeIndicator, type IndicatorDef } from '@/lib/chart/indicators'
import type { ChartType, PriceScaleModeName } from '@/lib/chart/chartTypes'
import type { RangePreset } from '@/lib/chart/ranges'
import { clearWorkspace, loadWorkspace, saveWorkspace } from '@/lib/chart/workspace'

export type SignalDef = {
  id: string
  name: string
  condition: Condition
  range?: { from?: number; to?: number }
  color: string
  position: 'aboveBar' | 'belowBar'
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown'
}

export type PriceLineDef = { id: string; price: number; label: string; color: string }
export type VerticalLineDef = { id: string; time: number; label: string; color: string }

/** Everything the AI draws. Anchors always come from the analysis engine. */
export type Drawing =
  | { id: string; kind: 'trendline'; line: Trendline }
  | { id: string; kind: 'fibonacci'; fib: FibonacciRetracement }
  | { id: string; kind: 'channel'; channel: RegressionChannel }
  | { id: string; kind: 'pattern'; pattern: ChartPattern }

/**
 * `Omit<Drawing, 'id'>` collapses a discriminated union to its shared keys, so
 * distribute over the members instead.
 */
type WithoutId<T> = T extends { id: string } ? Omit<T, 'id'> : never
export type DrawingInput = WithoutId<Drawing>
export type HighlightDef = { id: string; from: number; to: number; label: string; color: string }
export type ZoomRequest = { from: number; to?: number; nonce: number }

export type ClearScope = 'all' | 'signals' | 'lines' | 'highlights' | 'indicators'

const SIGNAL_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7']

export type ChartState = {
  symbol: string
  timeframe: Timeframe
  chartType: ChartType
  priceScaleMode: PriceScaleModeName
  /** The last range preset the user picked; null once they pan or zoom freely. */
  rangePreset: RangePreset | null
  recentSymbols: string[]
  indicators: IndicatorDef[]
  signals: SignalDef[]
  priceLines: PriceLineDef[]
  highlights: HighlightDef[]
  levels: Level[]
  drawings: Drawing[]
  verticalLines: VerticalLineDef[]
  zoomRequest: ZoomRequest | null

  setSymbol: (symbol: string) => void
  setTimeframe: (timeframe: Timeframe) => void
  setChartType: (chartType: ChartType) => void
  setPriceScaleMode: (mode: PriceScaleModeName) => void
  setRangePreset: (preset: RangePreset | null) => void
  /** Reads the saved workspace after mount, so SSR and first paint agree. */
  hydrate: () => void
  resetWorkspace: () => void
  addIndicator: (type: IndicatorType, params?: IndicatorParams) => IndicatorDef
  removeIndicator: (type: IndicatorType, params?: IndicatorParams) => number
  removeIndicatorById: (id: string) => void
  setIndicatorParams: (id: string, params: IndicatorParams) => void
  updateIndicator: (type: IndicatorType, params: IndicatorParams) => IndicatorDef | null
  upsertSignal: (signal: Omit<SignalDef, 'id' | 'color'> & { id?: string; color?: string }) => SignalDef
  updateSignal: (
    name: string | undefined,
    patch: Partial<Omit<SignalDef, 'id'>>,
  ) => SignalDef | null
  removeSignal: (name?: string) => number
  addPriceLine: (line: Omit<PriceLineDef, 'id'>) => void
  addHighlight: (highlight: Omit<HighlightDef, 'id'>) => void
  setLevels: (levels: Level[]) => void
  addDrawing: (drawing: DrawingInput) => void
  replaceDrawings: (kind: Drawing['kind'], drawings: DrawingInput[]) => void
  addVerticalLine: (line: Omit<VerticalLineDef, 'id'>) => void
  requestZoom: (from: number, to?: number) => void
  clear: (scope: ClearScope) => void
}

let counter = 0
const nextId = (prefix: string) => `${prefix}-${++counter}`

export const useChartStore = create<ChartState>()((set, get) => ({
  symbol: 'BTCUSDT',
  timeframe: '1D',
  chartType: 'candles',
  priceScaleMode: 'normal',
  rangePreset: null,
  recentSymbols: [],
  indicators: [],
  signals: [],
  priceLines: [],
  highlights: [],
  levels: [],
  drawings: [],
  verticalLines: [],
  zoomRequest: null,

  setSymbol: (symbol) => {
    const next = symbol.toUpperCase()
    if (next === get().symbol) return
    const recent = [get().symbol, ...get().recentSymbols.filter((s) => s !== get().symbol && s !== next)]
    // Annotations are tied to the previous instrument; indicators and signals carry over.
    set({
      symbol: next,
      recentSymbols: recent.slice(0, 12),
      priceLines: [],
      highlights: [],
      levels: [],
      drawings: [],
      verticalLines: [],
      zoomRequest: null,
    })
  },

  setTimeframe: (timeframe) =>
    set({ timeframe, levels: [], drawings: [], verticalLines: [], zoomRequest: null }),

  setChartType: (chartType) => set({ chartType }),
  setPriceScaleMode: (priceScaleMode) => set({ priceScaleMode }),
  setRangePreset: (rangePreset) => set({ rangePreset }),

  hydrate: () => {
    const saved = loadWorkspace()
    if (!saved) return
    set({
      symbol: saved.symbol,
      timeframe: saved.timeframe,
      chartType: saved.chartType,
      priceScaleMode: saved.priceScaleMode,
      recentSymbols: saved.recentSymbols,
      indicators: saved.indicators.map((entry, index) =>
        normalizeIndicator(entry.type, entry.params, index),
      ),
      signals: saved.signals.map((signal) => ({ ...signal, id: nextId('signal') })),
    })
  },

  resetWorkspace: () => {
    clearWorkspace()
    set({
      symbol: 'BTCUSDT',
      timeframe: '1D',
      chartType: 'candles',
      priceScaleMode: 'normal',
      rangePreset: null,
      recentSymbols: [],
      indicators: [],
      signals: [],
      priceLines: [],
      highlights: [],
      levels: [],
      drawings: [],
      verticalLines: [],
      zoomRequest: null,
    })
  },

  addIndicator: (type, params) => {
    const existing = get().indicators
    const def = normalizeIndicator(type, params, existing.length)
    if (!existing.some((i) => i.id === def.id)) set({ indicators: [...existing, def] })
    return def
  },

  removeIndicator: (type, params) => {
    const existing = get().indicators
    const target = params ? normalizeIndicator(type, params).id : null
    const kept = existing.filter((i) => (target ? i.id !== target : i.type !== type))
    set({ indicators: kept })
    return existing.length - kept.length
  },

  removeIndicatorById: (id) =>
    set((state) => ({ indicators: state.indicators.filter((i) => i.id !== id) })),

  setIndicatorParams: (id, params) =>
    set((state) => {
      const index = state.indicators.findIndex((i) => i.id === id)
      const current = state.indicators[index]
      if (!current) return {}
      const next = normalizeIndicator(current.type, { ...current.params, ...params }, index)
      // Collapse onto an existing identical indicator rather than duplicating it.
      if (state.indicators.some((i, idx) => idx !== index && i.id === next.id)) {
        return { indicators: state.indicators.filter((i) => i.id !== id) }
      }
      return {
        indicators: state.indicators.map((i, idx) =>
          idx === index ? { ...next, color: current.color } : i,
        ),
      }
    }),

  updateIndicator: (type, params) => {
    const existing = get().indicators
    const index = existing.findIndex((i) => i.type === type)
    if (index === -1) return null
    const current = existing[index]
    if (!current) return null
    const updated = normalizeIndicator(type, { ...current.params, ...params }, index)
    set({ indicators: existing.map((i, idx) => (idx === index ? { ...updated, color: current.color } : i)) })
    return updated
  },

  upsertSignal: (signal) => {
    const existing = get().signals
    const match = existing.find((s) => s.name.toLowerCase() === signal.name.toLowerCase())
    const def: SignalDef = {
      ...signal,
      id: match?.id ?? signal.id ?? nextId('signal'),
      color: signal.color ?? match?.color ?? (SIGNAL_COLORS[existing.length % SIGNAL_COLORS.length] as string),
    }
    set({ signals: match ? existing.map((s) => (s.id === match.id ? def : s)) : [...existing, def] })
    return def
  },

  updateSignal: (name, patch) => {
    const existing = get().signals
    const target = name
      ? existing.find((s) => s.name.toLowerCase() === name.toLowerCase())
      : existing[existing.length - 1]
    if (!target) return null
    const updated: SignalDef = { ...target, ...patch, id: target.id }
    set({ signals: existing.map((s) => (s.id === target.id ? updated : s)) })
    return updated
  },

  removeSignal: (name) => {
    const existing = get().signals
    if (!name) {
      set({ signals: [] })
      return existing.length
    }
    const kept = existing.filter((s) => s.name.toLowerCase() !== name.toLowerCase())
    set({ signals: kept })
    return existing.length - kept.length
  },

  addPriceLine: (line) =>
    set((state) => ({ priceLines: [...state.priceLines, { ...line, id: nextId('line') }] })),

  addHighlight: (highlight) =>
    set((state) => ({ highlights: [...state.highlights, { ...highlight, id: nextId('band') }] })),

  setLevels: (levels) => set({ levels }),

  addDrawing: (drawing) =>
    set((state) => ({ drawings: [...state.drawings, { ...drawing, id: nextId('draw') }] })),

  // Re-running the same kind of drawing replaces it rather than stacking copies.
  replaceDrawings: (kind, drawings) =>
    set((state) => ({
      drawings: [
        ...state.drawings.filter((d) => d.kind !== kind),
        ...drawings.map((d) => ({ ...d, id: nextId('draw') })),
      ],
    })),

  addVerticalLine: (line) =>
    set((state) => ({ verticalLines: [...state.verticalLines, { ...line, id: nextId('vline') }] })),

  requestZoom: (from, to) => set({ zoomRequest: { from, to, nonce: ++counter } }),

  clear: (scope) =>
    set(() => {
      switch (scope) {
        case 'signals':
          return { signals: [] }
        case 'lines':
          return { priceLines: [], levels: [], drawings: [], verticalLines: [] }
        case 'highlights':
          return { highlights: [] }
        case 'indicators':
          return { indicators: [] }
        case 'all':
        default:
          return {
            signals: [],
            priceLines: [],
            highlights: [],
            levels: [],
            drawings: [],
            verticalLines: [],
          }
      }
    }),
}))

/**
 * Persist whatever a returning user would expect to find. Subscribed rather than
 * written inside each action, so no future action can forget to save.
 */
let saveTimer: ReturnType<typeof setTimeout> | null = null
useChartStore.subscribe((state) => {
  if (typeof window === 'undefined') return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveWorkspace({
      version: 1,
      symbol: state.symbol,
      timeframe: state.timeframe,
      chartType: state.chartType,
      priceScaleMode: state.priceScaleMode,
      recentSymbols: state.recentSymbols,
      indicators: state.indicators.map((i) => ({ type: i.type, params: i.params })),
      signals: state.signals.map((signal) => ({
        name: signal.name,
        condition: signal.condition,
        ...(signal.range ? { range: signal.range } : {}),
        color: signal.color,
        position: signal.position,
        shape: signal.shape,
      })),
    })
  }, 400)
})
