'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle } from '@/lib/types'
import { evaluateSignal, type SignalMatch } from '@/lib/analysis/signals'
import { buildIndicatorPlots } from '@/lib/chart/series'
import { useChartStore, type SignalDef } from '@/stores/chartStore'
import { useT } from '@/stores/localeStore'
import { ChartLegend } from './ChartLegend'
import { SignalTooltip } from './SignalTooltip'

/** Price pane gets this many times the height of one indicator pane. */
const PRICE_PANE_STRETCH = 5

type Props = { candles: Candle[]; loading: boolean; error?: string | null }

export type SignalHit = SignalMatch & { signal: SignalDef }

export function FinancialChart({ candles, loading, error }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const indicatorSeriesRef = useRef<ISeriesApi<SeriesType>[]>([])
  const priceLinesRef = useRef<IPriceLine[]>([])

  const t = useT()
  const indicators = useChartStore((s) => s.indicators)
  const signals = useChartStore((s) => s.signals)
  const priceLines = useChartStore((s) => s.priceLines)
  const highlights = useChartStore((s) => s.highlights)
  const levels = useChartStore((s) => s.levels)
  const zoomRequest = useChartStore((s) => s.zoomRequest)

  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [bands, setBands] = useState<Array<{ id: string; left: number; width: number; label: string; color: string }>>([])

  const plots = useMemo(() => buildIndicatorPlots(candles, indicators), [candles, indicators])

  const hits = useMemo<SignalHit[]>(() => {
    if (candles.length === 0) return []
    return signals.flatMap((signal) =>
      evaluateSignal(candles, signal.condition, signal.range).map((match) => ({ ...match, signal })),
    )
  }, [candles, signals])

  /* ---------- chart lifecycle ---------- */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0d12' },
        textColor: '#7b8798',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: 11,
        attributionLogo: false,
        panes: { separatorColor: '#1e2634', separatorHoverColor: '#2b3445' },
      },
      grid: {
        vertLines: { color: '#141a24' },
        horzLines: { color: '#141a24' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#3a465c', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1e2634' },
        horzLine: { color: '#3a465c', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1e2634' },
      },
      rightPriceScale: { borderColor: '#1e2634', scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: '#1e2634', rightOffset: 6, barSpacing: 7 },
      autoSize: true,
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      borderVisible: false,
      priceLineColor: '#3a465c',
      lastValueVisible: true,
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries
    markersRef.current = createSeriesMarkers(candleSeries, [])

    return () => {
      markersRef.current = null
      indicatorSeriesRef.current = []
      priceLinesRef.current = []
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      chartRef.current = null
      chart.remove()
    }
  }, [])

  /* ---------- price + volume data ---------- */
  useEffect(() => {
    const candleSeries = candleSeriesRef.current
    const volumeSeries = volumeSeriesRef.current
    if (!candleSeries || !volumeSeries) return

    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    )
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(38, 166, 154, 0.34)' : 'rgba(239, 83, 80, 0.34)',
      })),
    )
    chartRef.current?.timeScale().fitContent()
  }, [candles])

  /* ---------- indicators ---------- */
  useEffect(() => {
    const chart = chartRef.current
    const volumeSeries = volumeSeriesRef.current
    if (!chart || !volumeSeries) return

    for (const series of indicatorSeriesRef.current) chart.removeSeries(series)
    indicatorSeriesRef.current = []
    while (chart.panes().length > 1) chart.removePane(chart.panes().length - 1)

    let paneIndex = 0
    for (const plot of plots) {
      if (plot.target === 'own') {
        paneIndex += 1
        while (chart.panes().length <= paneIndex) chart.addPane()
      }
      const pane = plot.target === 'own' ? paneIndex : 0
      const priceScaleId = plot.target === 'volume' ? 'volume' : undefined

      for (const line of plot.lines) {
        if (line.style === 'histogram') {
          const hist = chart.addSeries(
            HistogramSeries,
            { priceLineVisible: false, lastValueVisible: false, ...(priceScaleId ? { priceScaleId } : {}) },
            pane,
          )
          hist.setData(
            line.data.map((point) => ({
              time: point.time as UTCTimestamp,
              value: point.value,
              color: point.value >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
            })),
          )
          indicatorSeriesRef.current.push(hist)
          continue
        }

        const series = chart.addSeries(
          LineSeries,
          {
            color: line.color,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: plot.target !== 'price',
            crosshairMarkerVisible: false,
            ...(priceScaleId ? { priceScaleId } : {}),
          },
          pane,
        )
        series.setData(line.data.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })))
        indicatorSeriesRef.current.push(series)
      }

      const first = indicatorSeriesRef.current[indicatorSeriesRef.current.length - 1]
      if (plot.guides && first) {
        for (const level of plot.guides) {
          first.createPriceLine({
            price: level,
            color: '#3d4c66',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: false,
            title: '',
          })
        }
      }
    }

    // Ratios, not pixels: setHeight resolves against the other panes one call at a
    // time, so the last call would win and squash everything else.
    const panes = chart.panes()
    for (let i = 0; i < panes.length; i++) {
      panes[i]?.setStretchFactor(i === 0 ? PRICE_PANE_STRETCH : 1)
    }
  }, [plots])

  /* ---------- signal markers ---------- */
  useEffect(() => {
    const markers = markersRef.current
    if (!markers) return
    const sorted = [...hits].sort((a, b) => a.time - b.time)
    markers.setMarkers(
      sorted.map<SeriesMarker<Time>>((hit) => ({
        time: hit.time as UTCTimestamp,
        position: hit.signal.position,
        color: hit.signal.color,
        shape: hit.signal.shape,
        size: 1,
      })),
    )
  }, [hits])

  /* ---------- price lines & S/R levels ---------- */
  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series) return
    for (const line of priceLinesRef.current) series.removePriceLine(line)
    priceLinesRef.current = []

    for (const line of priceLines) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: line.price,
          color: line.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: line.label,
        }),
      )
    }
    for (const level of levels) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: level.price,
          color: level.kind === 'support' ? '#26a69a' : '#ef5350',
          lineWidth: level.strength > 0.66 ? 2 : 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `${level.kind === 'support' ? 'S' : 'R'} ·${level.touches}`,
        }),
      )
    }
  }, [priceLines, levels])

  /* ---------- zoom ---------- */
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !zoomRequest || candles.length === 0) return
    const last = candles[candles.length - 1]
    chart.timeScale().setVisibleRange({
      from: zoomRequest.from as UTCTimestamp,
      to: (zoomRequest.to ?? last?.time ?? zoomRequest.from) as UTCTimestamp,
    })
  }, [zoomRequest, candles])

  /* ---------- highlight bands ---------- */
  const syncBands = useCallback(() => {
    const chart = chartRef.current
    if (!chart) {
      setBands([])
      return
    }
    const scale = chart.timeScale()
    const next = highlights.flatMap((h) => {
      const left = scale.timeToCoordinate(h.from as UTCTimestamp)
      const right = scale.timeToCoordinate(h.to as UTCTimestamp)
      if (left === null || right === null) return []
      return [{ id: h.id, left: Math.min(left, right), width: Math.abs(right - left), label: h.label, color: h.color }]
    })
    setBands(next)
  }, [highlights])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const scale = chart.timeScale()
    scale.subscribeVisibleLogicalRangeChange(syncBands)
    syncBands()
    return () => scale.unsubscribeVisibleLogicalRangeChange(syncBands)
  }, [syncBands, candles])

  /* ---------- crosshair ---------- */
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const byTime = new Map(candles.map((c, i) => [c.time, i]))
    const handler = (param: { time?: Time }) => {
      const time = typeof param.time === 'number' ? param.time : undefined
      setHoverIndex(time === undefined ? null : (byTime.get(time) ?? null))
    }
    chart.subscribeCrosshairMove(handler)
    return () => chart.unsubscribeCrosshairMove(handler)
  }, [candles])

  const hoverCandle = hoverIndex === null ? undefined : candles[hoverIndex]
  const activeHits = useMemo(
    () => (hoverCandle ? hits.filter((h) => h.time === hoverCandle.time) : []),
    [hits, hoverCandle],
  )

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {bands.map((band) => (
          <div
            key={band.id}
            className="absolute top-0 bottom-0 border-x"
            style={{
              left: band.left,
              width: band.width,
              background: `${band.color}14`,
              borderColor: `${band.color}55`,
            }}
          >
            <span className="absolute top-1 left-1 rounded-sm bg-raised/90 px-1.5 py-0.5 text-[10px] text-muted">
              {band.label}
            </span>
          </div>
        ))}
      </div>

      <ChartLegend candles={candles} hoverIndex={hoverIndex} plots={plots} />
      {activeHits.length > 0 && hoverCandle ? <SignalTooltip hits={activeHits} /> : null}

      {loading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-base/70 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="h-3 w-3 animate-spin rounded-full border border-line border-t-accent" />
            {t('chart.loading')}
          </div>
        </div>
      ) : null}

      {error && !loading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-base/80">
          <div className="max-w-sm rounded-md border border-line bg-surface px-4 py-3 text-center">
            <p className="text-sm text-down">{t('chart.error.title')}</p>
            <p className="mt-1 text-xs text-muted">{error}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
