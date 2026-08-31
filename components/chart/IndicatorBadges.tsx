'use client'

import { X } from 'lucide-react'
import { useChartStore } from '@/stores/chartStore'
import { indicatorLabel } from '@/lib/chart/indicators'
import { indicatorSpec } from '@/lib/analysis/indicators/registry'
import type { IndicatorType } from '@/lib/schemas/chartCommand'
import { describeCondition } from '@/lib/chart/describe'
import { useT } from '@/stores/localeStore'

/**
 * A single-knob indicator gets its period edited inline, so the badge shows the
 * short name plus an input. Anything with several parameters shows a full label.
 */
function inlineEditable(type: IndicatorType): string | null {
  const spec = indicatorSpec(type)
  return spec.params.length === 1 && spec.params[0]?.key === 'period' ? spec.short : null
}

export function IndicatorBadges() {
  const indicators = useChartStore((s) => s.indicators)
  const signals = useChartStore((s) => s.signals)
  const removeIndicatorById = useChartStore((s) => s.removeIndicatorById)
  const setIndicatorParams = useChartStore((s) => s.setIndicatorParams)
  const removeSignal = useChartStore((s) => s.removeSignal)
  const t = useT()

  if (indicators.length === 0 && signals.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface px-3 py-1.5">
      {indicators.map((def) => (
        <span
          key={def.id}
          data-indicator-badge=""
          className="group flex items-center gap-1.5 rounded border border-line bg-raised py-0.5 pr-1 pl-1.5 text-[11px] text-muted"
        >
          <span className="h-[2px] w-2.5 rounded-full" style={{ background: def.color }} />
          {inlineEditable(def.type) ?? indicatorLabel(def)}
          {inlineEditable(def.type) ? (
            <input
              type="number"
              min={1}
              max={1000}
              defaultValue={def.params.period}
              onBlur={(event) => {
                const period = Number(event.target.value)
                if (Number.isInteger(period) && period > 0 && period !== def.params.period) {
                  setIndicatorParams(def.id, { period })
                }
              }}
              aria-label={t('indicators.period', { type: def.type })}
              className="w-8 appearance-none rounded-sm border border-transparent bg-transparent text-center text-[11px] tnum text-faint outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none hover:border-line focus:border-accent focus:text-text"
            />
          ) : null}
          <button
            type="button"
            onClick={() => removeIndicatorById(def.id)}
            aria-label={t('indicators.remove', { name: indicatorLabel(def) })}
            className="rounded-sm p-0.5 text-faint hover:bg-line hover:text-text"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {signals.map((signal) => (
        <span
          key={signal.id}
          data-signal-badge=""
          title={describeCondition(signal.condition)}
          className="flex max-w-72 items-center gap-1.5 rounded border py-0.5 pr-1 pl-1.5 text-[11px]"
          style={{ borderColor: `${signal.color}55`, background: `${signal.color}14`, color: signal.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: signal.color }} />
          <span className="truncate">{signal.name}</span>
          <button
            type="button"
            onClick={() => removeSignal(signal.name)}
            aria-label={t('indicators.remove', { name: signal.name })}
            className="rounded-sm p-0.5 opacity-70 hover:bg-line hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )
}
