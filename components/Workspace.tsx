'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCandles } from '@/lib/useCandles'
import { useChartStore } from '@/stores/chartStore'
import { ChartToolbar } from '@/components/chart/ChartToolbar'
import { IndicatorBadges } from '@/components/chart/IndicatorBadges'
import { FinancialChart } from '@/components/chart/FinancialChart'
import { AIChatPanel } from '@/components/ai/AIChatPanel'

const MIN_PANEL = 300
const MAX_PANEL = 560

export function Workspace() {
  const symbol = useChartStore((s) => s.symbol)
  const timeframe = useChartStore((s) => s.timeframe)
  const setTimeframe = useChartStore((s) => s.setTimeframe)

  const { data, isPending, error } = useCandles(symbol, timeframe)
  const candles = data?.candles ?? []

  const available = data?.supportedTimeframes

  // A provider swap (crypto -> equity) can strand an unsupported timeframe.
  useEffect(() => {
    if (available && available.length > 0 && !available.includes(timeframe)) setTimeframe('1D')
  }, [available, timeframe, setTimeframe])

  const [panelWidth, setPanelWidth] = useState(360)
  const dragging = useRef(false)

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!dragging.current) return
    const next = window.innerWidth - event.clientX
    setPanelWidth(Math.min(MAX_PANEL, Math.max(MIN_PANEL, next)))
  }, [])

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    dragging.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-base">
      <ChartToolbar
        candles={candles}
        synthetic={data?.synthetic ?? false}
        providerId={data?.provider}
        available={available}
      />
      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          <IndicatorBadges />
          <div className="min-h-0 flex-1">
            <FinancialChart
              candles={candles}
              loading={isPending}
              error={error instanceof Error ? error.message : null}
            />
          </div>
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize AI panel"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="w-px shrink-0 cursor-col-resize bg-line transition-colors hover:bg-accent/60"
          style={{ boxShadow: '0 0 0 2px transparent' }}
        />

        <div style={{ width: panelWidth }} className="shrink-0">
          <AIChatPanel candles={candles} />
        </div>
      </div>
    </main>
  )
}
