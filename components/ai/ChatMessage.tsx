'use client'

import { useEffect, useState } from 'react'
import type { ChatEntry } from '@/stores/aiStore'
import { useT } from '@/stores/localeStore'
import { CommandResultList } from './CommandResultList'

/**
 * A reasoning model produces nothing for the first several seconds. An elapsed
 * counter is the difference between "working" and "frozen".
 */
function Waiting({ since }: { since: number }) {
  const t = useT()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const tick = () => setElapsed((Date.now() - since) / 1000)
    tick()
    const timer = setInterval(tick, 100)
    return () => clearInterval(timer)
  }, [since])

  return (
    <span className="flex items-center gap-2 text-[11px] text-faint">
      <span className="h-3 w-3 animate-spin rounded-full border border-line border-t-accent" />
      {t('ai.thinking')}
      <span className="tnum">{elapsed.toFixed(1)}s</span>
    </span>
  )
}

export function ChatMessage({ entry }: { entry: ChatEntry }) {
  const t = useT()

  if (entry.role === 'user') {
    return (
      <div className="animate-in-soft flex justify-end">
        <p className="max-w-[85%] rounded-lg rounded-br-sm bg-raised px-3 py-2 text-[12.5px] leading-relaxed break-words text-text">
          {entry.content}
        </p>
      </div>
    )
  }

  return (
    <div className="animate-in-soft">
      <div className="flex items-center gap-1.5 pb-1">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="text-[10.5px] tracking-wide text-faint uppercase">
          {t('ai.role')}
          {entry.mode ? ` · ${entry.mode}` : ''}
        </span>
      </div>
      {entry.streaming && !entry.content ? (
        <Waiting since={entry.startedAt ?? Date.now()} />
      ) : (
        <p
          className={`text-[12.5px] leading-relaxed break-words ${entry.failed ? 'text-down' : 'text-muted'}`}
        >
          {entry.content}
          {entry.streaming ? (
            <span className="ml-0.5 inline-block h-3 w-[2px] translate-y-[2px] animate-pulse bg-accent" />
          ) : null}
        </p>
      )}
      {entry.results ? <CommandResultList results={entry.results} /> : null}
    </div>
  )
}
