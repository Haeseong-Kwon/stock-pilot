'use client'

import { useMemo } from 'react'
import type { Candle } from '@/lib/types'
import type { IndicatorPlot } from '@/lib/chart/series'
import { formatDate, formatPercent, formatPrice, formatVolume } from '@/lib/format'
import { useChartStore } from '@/stores/chartStore'

type Props = { candles: Candle[]; hoverIndex: number | null; plots: IndicatorPlot[] }

export function ChartLegend({ candles, hoverIndex, plots }: Props) {
  const symbol = useChartStore((s) => s.symbol)
  const timeframe = useChartStore((s) => s.timeframe)

  const lookups = useMemo(
    () =>
      plots.flatMap((plot) =>
        plot.lines.map((line) => ({
          label: line.label,
          color: line.color,
          byTime: new Map(line.data.map((p) => [p.time, p.value])),
        })),
      ),
    [plots],
  )

  if (candles.length === 0) return null
  const index = hoverIndex ?? candles.length - 1
  const candle = candles[index] ?? candles[candles.length - 1]
  if (!candle) return null
  const previous = candles[index - 1]
  const change = previous ? (candle.close - previous.close) / previous.close : 0
  const up = candle.close >= candle.open

  return (
    <div className="pointer-events-none absolute top-2 left-3 z-10 flex flex-col gap-1 text-[11px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tnum">
        <span className="text-[12px] font-semibold tracking-wide text-text">{symbol}</span>
        <span className="text-faint">{timeframe}</span>
        <span className="text-muted">{formatDate(candle.time, timeframe.endsWith('m') || timeframe.endsWith('h'))}</span>
        <span className={up ? 'text-up' : 'text-down'}>
          O {formatPrice(candle.open)} H {formatPrice(candle.high)} L {formatPrice(candle.low)} C{' '}
          {formatPrice(candle.close)}
        </span>
        <span className={change >= 0 ? 'text-up' : 'text-down'}>{formatPercent(change)}</span>
        <span className="text-faint">Vol {formatVolume(candle.volume)}</span>
      </div>
      {lookups.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 tnum text-[10.5px]">
          {lookups.map((entry) => {
            const value = entry.byTime.get(candle.time)
            return (
              <span key={entry.label} className="flex items-center gap-1">
                <span className="h-[2px] w-3 rounded-full" style={{ background: entry.color }} />
                <span className="text-faint">{entry.label}</span>
                <span className="text-muted">{value === undefined ? '—' : formatPrice(value)}</span>
              </span>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
