'use client'

import type { Locale } from '@/lib/i18n/messages'
import { useLocale, useT } from '@/stores/localeStore'

const SUGGESTIONS: Record<Locale, string[]> = {
  ko: [
    '최근 1년간 5% 이상 떨어진 날 표시해',
    'RSI 추가하고 과매도 구간 표시',
    '거래량 급증한 곳 찾아줘',
    '최근 6개월 지지선과 저항선 찾아줘',
    '골든크로스 발생한 곳 표시',
    '볼린저밴드 아래로 이탈한 곳 보여줘',
  ],
  en: [
    'Mark days that dropped more than 5% in the last year',
    'Add RSI and mark oversold days',
    'Find volume spikes',
    'Find support and resistance over the last 6 months',
    'Mark golden crosses',
    'Show closes below the lower Bollinger band',
  ],
}

export function PromptSuggestions({ onPick }: { onPick: (prompt: string) => void }) {
  const locale = useLocale()
  const t = useT()

  return (
    <div className="px-3 pb-3">
      <p className="pb-2 text-[10.5px] tracking-wide text-faint uppercase">{t('ai.try')}</p>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS[locale].map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="rounded-full border border-line bg-raised px-2.5 py-1 text-left text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-text"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
