'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AreaChart, BarChart3, CandlestickChart, ChevronDown, LineChart, Ruler } from 'lucide-react'
import {
  CHART_TYPES,
  CHART_TYPE_LABELS,
  PRICE_SCALE_LABELS,
  PRICE_SCALE_MODES,
  type ChartType,
} from '@/lib/chart/chartTypes'
import { useChartStore } from '@/stores/chartStore'
import { useLocale, useT } from '@/stores/localeStore'

const TYPE_ICONS: Record<ChartType, typeof CandlestickChart> = {
  candles: CandlestickChart,
  hollow: CandlestickChart,
  bars: BarChart3,
  heikinAshi: CandlestickChart,
  line: LineChart,
  area: AreaChart,
}

/** Small dropdown shared by the chart-type and scale pickers. */
function Dropdown({
  label,
  title,
  children,
}: {
  label: ReactNode
  title: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={title}
        aria-label={title}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md border border-line bg-raised px-2 py-1.5 text-[11.5px] text-muted transition-colors hover:bg-line-soft hover:text-text"
      >
        {label}
        <ChevronDown className="h-3 w-3 text-faint" />
      </button>
      {open ? (
        <div className="animate-in-soft absolute top-full left-0 z-40 mt-1.5 w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-2xl">
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  )
}

function Row({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-raised ${
        selected ? 'text-text' : 'text-muted'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-accent' : 'bg-transparent'}`} />
      {children}
    </button>
  )
}

export function ChartTypeMenu() {
  const chartType = useChartStore((s) => s.chartType)
  const setChartType = useChartStore((s) => s.setChartType)
  const locale = useLocale()
  const t = useT()
  const Icon = TYPE_ICONS[chartType]

  return (
    <Dropdown
      title={t('toolbar.chartType')}
      label={
        <>
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">{CHART_TYPE_LABELS[chartType][locale]}</span>
        </>
      }
    >
      {(close) =>
        CHART_TYPES.map((type) => {
          const RowIcon = TYPE_ICONS[type]
          return (
            <Row
              key={type}
              selected={type === chartType}
              onClick={() => {
                setChartType(type)
                close()
              }}
            >
              <RowIcon className="h-3.5 w-3.5 text-faint" />
              {CHART_TYPE_LABELS[type][locale]}
            </Row>
          )
        })
      }
    </Dropdown>
  )
}

export function PriceScaleMenu() {
  const mode = useChartStore((s) => s.priceScaleMode)
  const setMode = useChartStore((s) => s.setPriceScaleMode)
  const locale = useLocale()
  const t = useT()

  return (
    <Dropdown
      title={t('toolbar.priceScale')}
      label={
        <>
          <Ruler className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">{PRICE_SCALE_LABELS[mode][locale]}</span>
        </>
      }
    >
      {(close) =>
        PRICE_SCALE_MODES.map((name) => (
          <Row
            key={name}
            selected={name === mode}
            onClick={() => {
              setMode(name)
              close()
            }}
          >
            {PRICE_SCALE_LABELS[name][locale]}
          </Row>
        ))
      }
    </Dropdown>
  )
}
