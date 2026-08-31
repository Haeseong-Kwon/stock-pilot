'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import type { IndicatorParams, IndicatorType } from '@/lib/schemas/chartCommand'
import { useChartStore } from '@/stores/chartStore'

type Preset = { label: string; hint: string; type: IndicatorType; params?: IndicatorParams }

const PRESETS: Preset[] = [
  { label: 'SMA 20', hint: 'Simple moving average', type: 'SMA', params: { period: 20 } },
  { label: 'SMA 50', hint: 'Simple moving average', type: 'SMA', params: { period: 50 } },
  { label: 'SMA 200', hint: 'Simple moving average', type: 'SMA', params: { period: 200 } },
  { label: 'EMA 20', hint: 'Exponential moving average', type: 'EMA', params: { period: 20 } },
  { label: 'EMA 50', hint: 'Exponential moving average', type: 'EMA', params: { period: 50 } },
  { label: 'RSI 14', hint: 'Relative strength index · own pane', type: 'RSI' },
  { label: 'MACD 12/26/9', hint: 'Convergence divergence · own pane', type: 'MACD' },
  { label: 'Bollinger 20, 2σ', hint: 'Volatility bands', type: 'BOLLINGER' },
  { label: 'ATR 14', hint: 'Average true range · own pane', type: 'ATR' },
  { label: 'Volume SMA 20', hint: 'Average volume overlay', type: 'VOLUME_SMA' },
]

export function IndicatorMenu() {
  const addIndicator = useChartStore((s) => s.addIndicator)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const filtered = PRESETS.filter((p) =>
    `${p.label} ${p.hint} ${p.type}`.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:bg-line-soft hover:text-text"
      >
        <Plus className="h-3.5 w-3.5" />
        Indicators
        <ChevronDown className="h-3 w-3 text-faint" />
      </button>

      {open ? (
        <div className="animate-in-soft absolute top-full right-0 z-40 mt-1.5 w-72 overflow-hidden rounded-lg border border-line bg-surface shadow-2xl">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter indicators…"
            className="w-full border-b border-line bg-transparent px-3 py-2.5 text-[12px] text-text outline-none placeholder:text-faint"
          />
          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-5 text-center text-[11px] text-faint">Nothing matches.</li>
            ) : null}
            {filtered.map((preset) => (
              <li key={preset.label}>
                <button
                  type="button"
                  onClick={() => {
                    addIndicator(preset.type, preset.params)
                    setOpen(false)
                  }}
                  className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-raised"
                >
                  <span className="text-[12px] text-text">{preset.label}</span>
                  <span className="text-[10.5px] text-faint">{preset.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
