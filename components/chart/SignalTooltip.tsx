'use client'

import type { SignalHit } from './FinancialChart'
import { formatNumber, formatPercent } from '@/lib/format'
import { useT } from '@/stores/localeStore'

export function SignalTooltip({ hits }: { hits: SignalHit[] }) {
  const t = useT()

  return (
    <div className="animate-in-soft pointer-events-none absolute top-14 left-3 z-10 w-56 rounded-md border border-line bg-surface/95 p-2.5 shadow-xl shadow-black/40 backdrop-blur">
      {hits.map((hit) => (
        <div key={`${hit.signal.id}-${hit.time}`} className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: hit.signal.color }} />
            <span className="font-medium text-text">{hit.signal.name}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tnum">
            <dt className="text-faint">{t('tooltip.change')}</dt>
            <dd className={hit.change !== null && hit.change < 0 ? 'text-down' : 'text-up'}>
              {hit.change === null ? '—' : formatPercent(hit.change)}
            </dd>
            <dt className="text-faint">{t('tooltip.volume')}</dt>
            <dd className="text-muted">
              {hit.volumeRatio === null
                ? '—'
                : t('tooltip.volumeRatio', { ratio: formatNumber(hit.volumeRatio, 1) })}
            </dd>
            <dt className="text-faint">{t('tooltip.rsi')}</dt>
            <dd className="text-muted">{formatNumber(hit.rsi, 1)}</dd>
          </dl>
        </div>
      ))}
    </div>
  )
}
