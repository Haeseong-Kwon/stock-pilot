'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import {
  INDICATOR_CATEGORIES,
  INDICATOR_LIST,

  indicatorSpec,
  type IndicatorCategory,
  type IndicatorType,
} from '@/lib/analysis/indicators/registry'
import { useChartStore } from '@/stores/chartStore'
import { useLocale, useT } from '@/stores/localeStore'

/** A handful of periods people reach for, so the common cases stay one click. */
const EXTRA_PERIODS: Partial<Record<IndicatorType, number[]>> = {
  SMA: [20, 50, 200],
  EMA: [20, 50, 200],
}

type Entry = {
  key: string
  type: IndicatorType
  label: string
  hint: string
  params?: { period: number }
}

export function IndicatorMenu() {
  const addIndicator = useChartStore((s) => s.addIndicator)
  const active = useChartStore((s) => s.indicators)
  const locale = useLocale()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
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

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return INDICATOR_CATEGORIES.map((category) => {
      const entries: Entry[] = []
      for (const { type, spec } of INDICATOR_LIST) {
        if (spec.category !== category) continue
        const periods = EXTRA_PERIODS[type]
        const base = spec.params[0]?.default
        for (const period of periods ?? [undefined]) {
          entries.push({
            key: period === undefined ? type : `${type}-${period}`,
            type,
            label:
              period !== undefined
                ? `${spec.short} ${period}`
                : spec.params.length > 0
                  ? `${spec.short} ${spec.params.map((p) => p.default).join('/')}`
                  : spec.short,
            hint: spec.description[locale],
            ...(period !== undefined ? { params: { period } } : {}),
          })
          void base
        }
      }
      return {
        category,
        entries: needle
          ? entries.filter((e) =>
              `${e.label} ${e.hint} ${indicatorSpec(e.type).name} ${e.type}`
                .toLowerCase()
                .includes(needle),
            )
          : entries,
      }
    }).filter((group) => group.entries.length > 0)
  }, [query, locale])

  const total = groups.reduce((sum, g) => sum + g.entries.length, 0)
  const activeIds = new Set(active.map((i) => i.id))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:bg-line-soft hover:text-text"
      >
        <Plus className="h-3.5 w-3.5" />
        {t('toolbar.indicators')}
        <ChevronDown className="h-3 w-3 text-faint" />
      </button>

      {open ? (
        <div className="animate-in-soft absolute top-full right-0 z-40 mt-1.5 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-2xl">
          <div className="flex shrink-0 items-center gap-2 border-b border-line px-3">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('indicators.filter')}
              className="w-full bg-transparent py-2.5 text-[12px] text-text outline-none placeholder:text-faint"
            />
            <span className="shrink-0 tnum text-[10px] text-faint">{total}</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {groups.length === 0 ? (
              <p className="px-3 py-5 text-center text-[11px] text-faint">{t('indicators.empty')}</p>
            ) : null}

            {groups.map((group) => (
              <section key={group.category}>
                <h3 className="px-3 pt-2 pb-1 text-[10px] tracking-wide text-faint uppercase">
                  {t(`indicators.category.${group.category}` as `indicators.category.${IndicatorCategory}`)}
                </h3>
                <ul>
                  {group.entries.map((entry) => {
                    const spec = indicatorSpec(entry.type)
                    const already = activeIds.has(
                      `${entry.type}:${Object.entries({
                        ...Object.fromEntries(spec.params.map((p) => [p.key, p.default])),
                        ...(entry.params ?? {}),
                      })
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join(',')}`,
                    )
                    return (
                      <li key={entry.key}>
                        <button
                          type="button"
                          onClick={() => {
                            addIndicator(entry.type, entry.params)
                            setOpen(false)
                          }}
                          className="flex w-full items-start justify-between gap-2 px-3 py-1.5 text-left hover:bg-raised"
                        >
                          <span className="min-w-0">
                            <span className="block text-[12px] text-text">{entry.label}</span>
                            <span className="block truncate text-[10.5px] text-faint">{entry.hint}</span>
                          </span>
                          {already ? (
                            <span className="mt-0.5 shrink-0 rounded border border-line px-1 text-[9.5px] text-faint">
                              ✓
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
