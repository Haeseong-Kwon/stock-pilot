'use client'

import type { ChatEntry } from '@/stores/aiStore'
import { useT } from '@/stores/localeStore'
import { CommandResultList } from './CommandResultList'

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
      <p
        className={`text-[12.5px] leading-relaxed break-words ${entry.failed ? 'text-down' : 'text-muted'}`}
      >
        {entry.content}
      </p>
      {entry.results ? <CommandResultList results={entry.results} /> : null}
    </div>
  )
}
