'use client'

import { useEffect, useRef, useState } from 'react'
import { Info, TriangleAlert } from 'lucide-react'
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n/messages'
import { TIMEFRAMES, type Candle, type Timeframe } from '@/lib/types'
import { formatPercent, formatPrice } from '@/lib/format'
import { useChartStore } from '@/stores/chartStore'
import { useLocaleStore, useT } from '@/stores/localeStore'
import { SymbolSearch } from '@/components/symbol/SymbolSearch'
import { IndicatorMenu } from './IndicatorMenu'
import { ChartTypeMenu, PriceScaleMenu } from './ChartSettings'
import { RangeBar } from './RangeBar'
import { SymbolStats } from './SymbolStats'

type Props = {
  candles: Candle[]
  synthetic: boolean
  providerId?: string
  /** Provided by the market endpoint; every timeframe is offered until it arrives. */
  available?: Timeframe[]
}

export function ChartToolbar({ candles, synthetic, providerId, available }: Props) {
  const timeframe = useChartStore((s) => s.timeframe)
  const setTimeframe = useChartStore((s) => s.setTimeframe)
  const t = useT()

  const last = candles[candles.length - 1]
  const previous = candles[candles.length - 2]
  const change = last && previous ? (last.close - previous.close) / previous.close : null

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
      <span className="flex items-center gap-1.5 pr-1">
        <span className="h-4 w-1 rounded-full bg-accent" />
        <span className="text-[13px] font-semibold tracking-tight">ChartPilot</span>
      </span>

      <SymbolSearch />

      {last ? (
        <div className="flex items-baseline gap-2 tnum">
          <span className="text-[15px] font-semibold text-text">{formatPrice(last.close)}</span>
          {change !== null ? (
            <span className={`text-[12px] ${change >= 0 ? 'text-up' : 'text-down'}`}>
              {formatPercent(change)}
            </span>
          ) : null}
        </div>
      ) : null}

      <SymbolStats candles={candles} />

      <div className="flex items-center rounded-md border border-line bg-raised p-0.5">
        {TIMEFRAMES.map((tf) => {
          const enabled = !available || available.includes(tf)
          return (
            <button
              key={tf}
              type="button"
              disabled={!enabled}
              title={
                enabled
                  ? undefined
                  : t('toolbar.timeframeUnsupported', {
                      provider: providerId ?? t('about.unknownProvider'),
                      timeframe: tf,
                    })
              }
              onClick={() => setTimeframe(tf as Timeframe)}
              className={`rounded px-2 py-1 text-[11px] transition-colors ${
                timeframe === tf
                  ? 'bg-line text-text'
                  : enabled
                    ? 'text-muted hover:text-text'
                    : 'cursor-not-allowed text-faint/40'
              }`}
            >
              {tf}
            </button>
          )
        })}
      </div>

      <RangeBar candles={candles} />
      <ChartTypeMenu />
      <PriceScaleMenu />

      <div className="ml-auto flex items-center gap-2">
        {synthetic ? (
          <span className="flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-400">
            <TriangleAlert className="h-3.5 w-3.5" />
            {t('toolbar.demoData')}
          </span>
        ) : null}
        <IndicatorMenu />
        <AboutButton providerId={providerId} />
      </div>
    </header>
  )
}

function AboutButton({ providerId }: { providerId?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  const resetWorkspace = useChartStore((s) => s.resetWorkspace)
  const t = useT()

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('toolbar.about')}
        className="rounded-md border border-line bg-raised p-1.5 text-faint transition-colors hover:text-text"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div className="animate-in-soft absolute top-full right-0 z-40 mt-1.5 w-72 rounded-lg border border-line bg-surface p-3 text-[11px] leading-relaxed text-muted shadow-2xl">
          <div className="flex items-center justify-between gap-2 pb-2.5">
            <span className="text-[11px] text-faint">{t('about.language')}</span>
            <div
              role="radiogroup"
              aria-label={t('about.language')}
              className="flex items-center rounded-md border border-line bg-raised p-0.5"
            >
              {LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={locale === code}
                  onClick={() => setLocale(code)}
                  className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
                    locale === code ? 'bg-line text-text' : 'text-muted hover:text-text'
                  }`}
                >
                  {LOCALE_LABELS[code]}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-line pt-2.5 pb-2.5">
            <p className="pb-1.5 text-[11px] text-faint">{t('about.shortcuts')}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              {(
                [
                  ['⌘K', t('about.shortcutSearch')],
                  ['D', t('about.shortcutData')],
                  ['L', t('about.shortcutLog')],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="contents">
                  <dt>
                    <kbd className="rounded border border-line px-1 text-[10px] text-faint">{key}</kbd>
                  </dt>
                  <dd className="text-faint">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="border-t border-line pt-2.5">
            <p className="mb-2 text-[12px] font-medium text-text">{t('about.title')}</p>
            <p>{t('about.body')}</p>
            <p className="mt-2">
              {t('about.provider')}:{' '}
              <span className="text-text">{providerId ?? t('about.unknownProvider')}</span>
            </p>
            <p className="mt-2 text-faint">{t('about.disclaimer')}</p>
            <button
              type="button"
              onClick={() => {
                resetWorkspace()
                setOpen(false)
              }}
              title={t('about.resetHint')}
              className="mt-2.5 w-full rounded-md border border-line bg-raised px-2 py-1.5 text-[11px] text-muted transition-colors hover:border-down/40 hover:text-down"
            >
              {t('about.reset')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
