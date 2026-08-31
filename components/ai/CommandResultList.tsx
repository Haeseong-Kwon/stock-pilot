'use client'

import { CheckCircle2, CircleSlash, TriangleAlert } from 'lucide-react'
import type { CommandResult } from '@/lib/chart/commandExecutor'
import { useT } from '@/stores/localeStore'

const ICONS = {
  ok: CheckCircle2,
  empty: CircleSlash,
  error: TriangleAlert,
} as const

const TONES = {
  ok: 'text-up',
  empty: 'text-faint',
  error: 'text-down',
} as const

export function CommandResultList({ results }: { results: CommandResult[] }) {
  const t = useT()
  if (results.length === 0) return null

  return (
    <ul className="mt-2 space-y-1.5">
      {results.map((result, index) => {
        const Icon = ICONS[result.status]
        return (
          <li
            key={`${result.type}-${index}`}
            className="rounded-md border border-line bg-base/60 px-2.5 py-2 text-[11px]"
          >
            <div className="flex items-center gap-1.5">
              <Icon className={`h-3.5 w-3.5 shrink-0 ${TONES[result.status]}`} />
              <span className="font-medium text-text">
                {result.labelKey ? t(result.labelKey) : result.label}
              </span>
              <span className="ml-auto font-mono text-[10px] tracking-tight text-faint">
                {result.type}
              </span>
            </div>
            {result.detail ? (
              <p className="mt-1 font-mono text-[10.5px] leading-relaxed break-words text-muted">
                {result.detail}
              </p>
            ) : null}
            {result.count !== undefined ? (
              <p className="mt-1 tnum text-muted">{t('result.matches', { count: result.count })}</p>
            ) : null}
            {result.messageKey ? <p className="mt-1 text-faint">{t(result.messageKey)}</p> : null}
          </li>
        )
      })}
    </ul>
  )
}
