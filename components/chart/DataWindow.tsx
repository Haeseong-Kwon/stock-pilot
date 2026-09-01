'use client'

import { X } from 'lucide-react'
import type { Candle } from '@/lib/types'
import type { IndicatorPlot } from '@/lib/chart/series'
import { formatDate, formatPercent, formatPrice, formatVolume } from '@/lib/format'
import { useChartStore } from '@/stores/chartStore'
import { useT } from '@/stores/localeStore'
import type { SignalHit } from './FinancialChart'

type Props = {
  candles: Candle[]
  hoverIndex: number | null
  plots: IndicatorPlot[]
  hits: SignalHit[]
  onClose: () => void
}

/**
 * Every series' value at the cursor, the way TradingView's Data Window works.
 * With 39 indicators available the one-line legend stops being readable.
 */
export function DataWindow({ candles, hoverIndex, plots, hits, onClose }: Props) {
  const t = useT()
  const timeframe = useChartStore((s) => s.timeframe)
  if (candles.length === 0) return null

  const index = hoverIndex ?? candles.length - 1
  const candle = candles[index] ?? candles[candles.length - 1]
  if (!candle) return null
  const previous = candles[index - 1]
  const change = previous && previous.close !== 0 ? (candle.close - previous.close) / previous.close : 0
  const intraday = timeframe.endsWith('m') || timeframe.endsWith('h')

  return (
    <div data-data-window="" className="animate-in-soft absolute top-2 right-3 z-10 w-56 rounded-md border border-line bg-surface/95 shadow-xl shadow-black/40 backdrop-blur">
      <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
        <span className="text-[10.5px] tracking-wide text-faint uppercase">{t('dataWindow.title')}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('dataWindow.close')}
          className="rounded p-0.5 text-faint transition-colors hover:text-text"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-2.5 py-2 text-[11px]">
        <p className="pb-1.5 tnum text-muted">{formatDate(candle.time, intraday)}</p>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tnum">
          {(
            [
              ['O', candle.open],
              ['H', candle.high],
              ['L', candle.low],
              ['C', candle.close],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-faint">{key}</dt>
              <dd className="text-right text-text">{formatPrice(value)}</dd>
            </div>
          ))}
          <dt className="text-faint">%</dt>
          <dd className={`text-right ${change >= 0 ? 'text-up' : 'text-down'}`}>
            {formatPercent(change)}
          </dd>
          <dt className="text-faint">Vol</dt>
          <dd className="text-right text-muted">{formatVolume(candle.volume)}</dd>
        </dl>

        {plots.length > 0 ? (
          <div className="mt-2 border-t border-line pt-2">
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 tnum">
              {plots.flatMap((plot) =>
                plot.lines.map((line) => {
                  const point = line.data.find((p) => p.time === candle.time)
                  return (
                    <div key={line.key} className="contents">
                      <dt className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-[2px] w-2.5 shrink-0 rounded-full"
                          style={{ background: line.color }}
                        />
                        <span className="truncate text-faint">{line.label}</span>
                      </dt>
                      <dd className="text-right text-muted">
                        {point ? formatPrice(point.value) : '—'}
                      </dd>
                    </div>
                  )
                }),
              )}
            </dl>
          </div>
        ) : null}

        {hits.length > 0 ? (
          <div className="mt-2 border-t border-line pt-2 space-y-1">
            {hits.map((hit) => (
              <p key={`${hit.signal.id}-${hit.time}`} className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: hit.signal.color }}
                />
                <span className="truncate text-text">{hit.signal.name}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
