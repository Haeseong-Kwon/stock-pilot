'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
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
import { RefreshCw } from 'lucide-react'
import type { Candle } from '@/lib/types'
import { evaluateSignal, type SignalMatch } from '@/lib/analysis/signals'
import { buildIndicatorPlots } from '@/lib/chart/series'
import { candlesForType, isSingleValueType, type ChartType } from '@/lib/chart/chartTypes'
import { rangeFor } from '@/lib/chart/ranges'
import { useChartStore, type SignalDef } from '@/stores/chartStore'
import { useT } from '@/stores/localeStore'
import { ChartLegend } from './ChartLegend'
import { DataWindow } from './DataWindow'
import { SignalTooltip } from './SignalTooltip'

/** Price pane gets this many times the height of one indicator pane. */
const PRICE_PANE_STRETCH = 5

const SCALE_MODES: Record<string, PriceScaleMode> = {
  normal: PriceScaleMode.Normal,
  logarithmic: PriceScaleMode.Logarithmic,
  percentage: PriceScaleMode.Percentage,
  indexedTo100: PriceScaleMode.IndexedTo100,
}

const UP = '#26a69a'
const DOWN = '#ef5350'

/** Each chart type is a different series; switching rebuilds it in place. */
function addPriceSeries(chart: IChartApi, type: ChartType): ISeriesApi<SeriesType> {
  switch (type) {
    case 'bars':
      return chart.addSeries(BarSeries, { upColor: UP, downColor: DOWN, thinBars: false })
    case 'line':
      return chart.addSeries(LineSeries, { color: '#4a9eff', lineWidth: 2 })
    case 'area':
      return chart.addSeries(AreaSeries, {
        lineColor: '#4a9eff',
        topColor: 'rgba(74, 158, 255, 0.35)',
        bottomColor: 'rgba(74, 158, 255, 0.02)',
        lineWidth: 2,
      })
    case 'hollow':
      // Hollow candles: up bars are outlined, down bars filled.
      return chart.addSeries(CandlestickSeries, {
        upColor: 'rgba(0,0,0,0)',
        downColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN,
        borderVisible: true,
        borderUpColor: UP,
        borderDownColor: DOWN,
      })
    case 'candles':
    case 'heikinAshi':
    default:
      return chart.addSeries(CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN,
        borderVisible: false,
        priceLineColor: '#3a465c',
      })
  }
}

type Props = {
  candles: Candle[]
  loading: boolean
  error?: string | null
  onRetry?: () => void
}

export type SignalHit = SignalMatch & { signal: SignalDef }

export function FinancialChart({ candles, loading, error, onRetry }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const indicatorSeriesRef = useRef<ISeriesApi<SeriesType>[]>([])
  const priceLinesRef = useRef<IPriceLine[]>([])
  const drawingSeriesRef = useRef<ISeriesApi<SeriesType>[]>([])

  const t = useT()
  const indicators = useChartStore((s) => s.indicators)
  const signals = useChartStore((s) => s.signals)
  const priceLines = useChartStore((s) => s.priceLines)
  const highlights = useChartStore((s) => s.highlights)
  const levels = useChartStore((s) => s.levels)
  const zoomRequest = useChartStore((s) => s.zoomRequest)
  const drawings = useChartStore((s) => s.drawings)
  const verticalLines = useChartStore((s) => s.verticalLines)
  const chartType = useChartStore((s) => s.chartType)
  const priceScaleMode = useChartStore((s) => s.priceScaleMode)
  const rangePreset = useChartStore((s) => s.rangePreset)

  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  // Bumped whenever the price series is recreated, so dependent effects re-run.
  const [seriesEpoch, setSeriesEpoch] = useState(0)
  const [dataWindow, setDataWindow] = useState(false)
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

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

    chartRef.current = chart
    volumeSeriesRef.current = volumeSeries

    return () => {
      markersRef.current = null
      indicatorSeriesRef.current = []
      drawingSeriesRef.current = []
      priceLinesRef.current = []
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      chartRef.current = null
      chart.remove()
    }
  }, [])

  /* ---------- price series: rebuilt when the chart type changes ---------- */
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const existing = candleSeriesRef.current
    if (existing) {
      markersRef.current = null
      priceLinesRef.current = []
      chart.removeSeries(existing)
    }

    const series = addPriceSeries(chart, chartType)
    candleSeriesRef.current = series
    markersRef.current = createSeriesMarkers(series, [])
    setSeriesEpoch((value) => value + 1)
  }, [chartType])

  /* ---------- price scale mode ---------- */
  useEffect(() => {
    // Scope this to the price series' own scale. `chart.priceScale('right')`
    // reaches every pane, and a log axis on MACD (which goes negative) or on a
    // bounded 0..100 oscillator is meaningless.
    candleSeriesRef.current?.priceScale().applyOptions({ mode: SCALE_MODES[priceScaleMode] })
  }, [priceScaleMode, seriesEpoch])

  /* ---------- price + volume data ---------- */
  useEffect(() => {
    const candleSeries = candleSeriesRef.current
    const volumeSeries = volumeSeriesRef.current
    if (!candleSeries || !volumeSeries) return

    const drawn = candlesForType(candles, chartType)
    if (isSingleValueType(chartType)) {
      candleSeries.setData(
        drawn.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })),
      )
    } else {
      candleSeries.setData(
        drawn.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      )
    }
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(38, 166, 154, 0.34)' : 'rgba(239, 83, 80, 0.34)',
      })),
    )
    chartRef.current?.timeScale().fitContent()
  }, [candles, chartType, seriesEpoch])

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
  }, [plots, seriesEpoch])

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
  }, [hits, seriesEpoch])

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
  }, [priceLines, levels, seriesEpoch])

  /* ---------- AI drawings: trendlines, fib, channel ---------- */
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    for (const series of drawingSeriesRef.current) chart.removeSeries(series)
    drawingSeriesRef.current = []
    if (candles.length === 0) return

    /** A straight line is just a two-point line series. */
    const segment = (
      a: { time: number; price: number },
      b: { time: number; price: number },
      color: string,
      style: LineStyle,
      width: 1 | 2,
      title: string,
    ) => {
      if (a.time === b.time) return
      const series = chart.addSeries(
        LineSeries,
        {
          color,
          lineWidth: width,
          lineStyle: style,
          priceLineVisible: false,
          lastValueVisible: Boolean(title),
          crosshairMarkerVisible: false,
          title,
        },
        0,
      )
      series.setData([
        { time: a.time as UTCTimestamp, value: a.price },
        { time: b.time as UTCTimestamp, value: b.price },
      ])
      drawingSeriesRef.current.push(series)
    }

    for (const drawing of drawings) {
      if (drawing.kind === 'trendline') {
        const { line } = drawing
        const color = line.kind === 'resistance' ? '#ef5350' : '#26a69a'
        // A broken line is drawn dashed, so it never reads as still holding.
        const style = line.brokenAt === undefined ? LineStyle.Solid : LineStyle.Dashed
        segment(line.from, line.to, color, style, 2, `${line.kind} ·${line.touches}`)
      }

      if (drawing.kind === 'fibonacci') {
        const { fib } = drawing
        for (const level of fib.levels) {
          const key = level.ratio === 0 || level.ratio === 1
          segment(
            { time: fib.from.time, price: level.price },
            { time: candles[candles.length - 1]?.time ?? fib.to.time, price: level.price },
            key ? '#a78bfa' : 'rgba(167, 139, 250, 0.55)',
            key ? LineStyle.Solid : LineStyle.Dotted,
            1,
            `${(level.ratio * 100).toFixed(1)}%`,
          )
        }
      }

      if (drawing.kind === 'pattern') {
        const { pattern } = drawing
        const color = pattern.bias === 'bearish' ? '#ef5350' : '#26a69a'
        // The shape itself: one polyline through its pivots.
        const shape = chart.addSeries(
          LineSeries,
          {
            color,
            lineWidth: 2,
            lineStyle: pattern.confirmed ? LineStyle.Solid : LineStyle.Dashed,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          },
          0,
        )
        shape.setData(
          pattern.points.map((point) => ({
            time: point.time as UTCTimestamp,
            value: point.price,
          })),
        )
        drawingSeriesRef.current.push(shape)

        segment(
          { time: pattern.necklineFrom, price: pattern.neckline },
          { time: pattern.necklineTo, price: pattern.neckline },
          color,
          LineStyle.Dotted,
          1,
          pattern.confirmed ? 'neckline ✓' : 'neckline',
        )
      }

      if (drawing.kind === 'channel') {
        const { channel } = drawing
        segment(
          { time: channel.from.time, price: channel.from.center },
          { time: channel.to.time, price: channel.to.center },
          '#f0b429',
          LineStyle.Solid,
          1,
          'mid',
        )
        for (const edge of ['upper', 'lower'] as const) {
          segment(
            { time: channel.from.time, price: channel.from[edge] },
            { time: channel.to.time, price: channel.to[edge] },
            'rgba(240, 180, 41, 0.5)',
            LineStyle.Dashed,
            1,
            edge,
          )
        }
      }
    }
  }, [drawings, candles, seriesEpoch])

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

  /* ---------- range presets ---------- */
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || candles.length === 0 || !rangePreset) return
    const range = rangeFor(rangePreset, candles)
    if (!range) chart.timeScale().fitContent()
    else chart.timeScale().setVisibleRange({ from: range.from as UTCTimestamp, to: range.to as UTCTimestamp })
  }, [rangePreset, candles])

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
    // A vertical line is a band with no width.
    const marks = verticalLines.flatMap((v) => {
      const x = scale.timeToCoordinate(v.time as UTCTimestamp)
      if (x === null) return []
      return [{ id: v.id, left: x, width: 0, label: v.label, color: v.color }]
    })
    setBands([...next, ...marks])
  }, [highlights, verticalLines])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const scale = chart.timeScale()
    scale.subscribeVisibleLogicalRangeChange(syncBands)
    syncBands()
    return () => scale.unsubscribeVisibleLogicalRangeChange(syncBands)
  }, [syncBands, candles, drawings])

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      // Never steal a key from the prompt box or the symbol search.
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'd' || event.key === 'D') setDataWindow((v) => !v)
      if (event.key === 'l' || event.key === 'L') {
        const store = useChartStore.getState()
        store.setPriceScaleMode(store.priceScaleMode === 'logarithmic' ? 'normal' : 'logarithmic')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
              background: band.width > 0 ? `${band.color}14` : 'transparent',
              borderColor: band.width > 0 ? `${band.color}55` : band.color,
              borderLeftStyle: band.width > 0 ? 'solid' : 'dashed',
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
      {dataWindow ? (
        <DataWindow
          candles={candles}
          hoverIndex={hoverIndex}
          plots={plots}
          hits={activeHits}
          onClose={() => setDataWindow(false)}
        />
      ) : null}

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
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-line bg-raised px-3 py-1.5 text-[11.5px] text-muted transition-colors hover:border-accent/40 hover:text-text"
              >
                <RefreshCw className="h-3 w-3" />
                {t('chart.retry')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
