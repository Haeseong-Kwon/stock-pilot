'use client'

import type { Candle } from '@/lib/types'
import { symbolStats } from '@/lib/chart/stats'
import { formatPercent, formatPrice, formatVolume } from '@/lib/format'
import { useT } from '@/stores/localeStore'

/** The header numbers a terminal shows next to the price. */
export function SymbolStats({ candles }: { candles: Candle[] }) {
  const t = useT()
  const stats = symbolStats(candles)
  if (!stats) return null

  return (
    <div className="hidden items-center gap-3 text-[10.5px] tnum text-faint 2xl:flex">
      <Stat label={t('stats.dayRange')}>
        {formatPrice(stats.dayLow)} – {formatPrice(stats.dayHigh)}
      </Stat>
      <Stat label={t('stats.periodRange')}>
        <span className="flex items-center gap-1.5">
          {formatPrice(stats.periodLow)}
          <span className="relative h-[3px] w-14 rounded-full bg-line">
            <span
              className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent"
              style={{ left: `calc(${(stats.periodPosition * 100).toFixed(1)}% - 3px)` }}
            />
          </span>
          {formatPrice(stats.periodHigh)}
        </span>
      </Stat>
      <Stat label={t('stats.volume')}>
        {formatVolume(stats.volume)}
        <span className={stats.volumeRatio >= 1 ? 'text-up' : 'text-faint'}>
          {' '}
          ({stats.volumeRatio.toFixed(1)}×)
        </span>
      </Stat>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-faint/70">{label}</span>
      <span className="text-muted">{children}</span>
    </span>
  )
}

export { formatPercent }
