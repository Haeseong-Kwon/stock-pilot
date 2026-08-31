'use client'

import { create } from 'zustand'
import type { Timeframe } from '@/lib/types'
import type { Condition } from '@/lib/schemas/expression'
import type { IndicatorParams, IndicatorType } from '@/lib/schemas/chartCommand'
import type { Level } from '@/lib/analysis/signals'
import { normalizeIndicator, type IndicatorDef } from '@/lib/chart/indicators'

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
export type HighlightDef = { id: string; from: number; to: number; label: string; color: string }
export type ZoomRequest = { from: number; to?: number; nonce: number }

export type ClearScope = 'all' | 'signals' | 'lines' | 'highlights' | 'indicators'

const SIGNAL_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7']

export type ChartState = {
  symbol: string
  timeframe: Timeframe
  indicators: IndicatorDef[]
  signals: SignalDef[]
  priceLines: PriceLineDef[]
  highlights: HighlightDef[]
  levels: Level[]
  zoomRequest: ZoomRequest | null

  setSymbol: (symbol: string) => void
  setTimeframe: (timeframe: Timeframe) => void
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
  requestZoom: (from: number, to?: number) => void
  clear: (scope: ClearScope) => void
}

let counter = 0
const nextId = (prefix: string) => `${prefix}-${++counter}`

export const useChartStore = create<ChartState>()((set, get) => ({
  symbol: 'BTCUSDT',
  timeframe: '1D',
  indicators: [],
  signals: [],
  priceLines: [],
  highlights: [],
  levels: [],
  zoomRequest: null,

  setSymbol: (symbol) => {
    if (symbol.toUpperCase() === get().symbol) return
    // Annotations are tied to the previous instrument; indicators and signals carry over.
    set({ symbol: symbol.toUpperCase(), priceLines: [], highlights: [], levels: [], zoomRequest: null })
  },

  setTimeframe: (timeframe) => set({ timeframe, levels: [], zoomRequest: null }),

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

  requestZoom: (from, to) => set({ zoomRequest: { from, to, nonce: ++counter } }),

  clear: (scope) =>
    set(() => {
      switch (scope) {
        case 'signals':
          return { signals: [] }
        case 'lines':
          return { priceLines: [], levels: [] }
        case 'highlights':
          return { highlights: [] }
        case 'indicators':
          return { indicators: [] }
        case 'all':
        default:
          return { signals: [], priceLines: [], highlights: [], levels: [] }
      }
    }),
}))
