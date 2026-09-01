'use client'

import type { Candle } from '@/lib/types'
import { RANGE_PRESETS, availableRanges } from '@/lib/chart/ranges'
import { useChartStore } from '@/stores/chartStore'
import { useT } from '@/stores/localeStore'

const LABELS: Record<string, string> = {
  '1M': '1M',
  '3M': '3M',
  '6M': '6M',
  YTD: 'YTD',
  '1Y': '1Y',
  '5Y': '5Y',
  ALL: 'ALL',
}

/** Time-range presets, the way every commercial terminal offers them. */
export function RangeBar({ candles }: { candles: Candle[] }) {
  const rangePreset = useChartStore((s) => s.rangePreset)
  const setRangePreset = useChartStore((s) => s.setRangePreset)
  const t = useT()
  const available = availableRanges(candles)

  return (
    <div
      role="group"
      aria-label={t('toolbar.range')}
      className="flex items-center gap-0.5 rounded-md border border-line bg-raised p-0.5"
    >
      {RANGE_PRESETS.filter((preset) => available.includes(preset)).map((preset) => (
        <button
          key={preset}
          type="button"
          aria-pressed={rangePreset === preset}
          onClick={() => setRangePreset(rangePreset === preset ? null : preset)}
          className={`rounded px-1.5 py-0.5 text-[10.5px] tnum transition-colors ${
            rangePreset === preset ? 'bg-line text-text' : 'text-muted hover:text-text'
          }`}
        >
          {LABELS[preset]}
        </button>
      ))}
    </div>
  )
}
