'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, Eraser, LayoutGrid } from 'lucide-react'
import type { Candle } from '@/lib/types'
import { buildChartContext } from '@/lib/ai/context'
import { readChatStream } from '@/lib/ai/chatStream'
import { executeCommands } from '@/lib/chart/commandExecutor'
import { useAiStore } from '@/stores/aiStore'
import { useChartStore } from '@/stores/chartStore'
import { useLocaleStore, useT } from '@/stores/localeStore'
import { ChatMessage } from './ChatMessage'
import { CommandGallery } from './CommandGallery'
import { PromptSuggestions } from './PromptSuggestions'

export function AIChatPanel({ candles }: { candles: Candle[] }) {
  const messages = useAiStore((s) => s.messages)
  const isSending = useAiStore((s) => s.isSending)
  const append = useAiStore((s) => s.append)
  const update = useAiStore((s) => s.update)
  const setSending = useAiStore((s) => s.setSending)
  const reset = useAiStore((s) => s.reset)
  const t = useT()

  const [draft, setDraft] = useState('')
  const [galleryOpen, setGalleryOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const candlesRef = useRef(candles)
  candlesRef.current = candles

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim()
      if (!prompt || useAiStore.getState().isSending) return

      setDraft('')
      append({ role: 'user', content: prompt })
      setSending(true)

      const chart = useChartStore.getState()
      const bars = candlesRef.current

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locale: useLocaleStore.getState().locale,
            messages: useAiStore
              .getState()
              .messages.slice(-12)
              .map((m) => ({ role: m.role, content: m.content })),
            context: buildChartContext({
              symbol: chart.symbol,
              timeframe: chart.timeframe,
              candles: bars,
              indicators: chart.indicators.map((i) => ({ type: i.type, params: i.params })),
              signals: chart.signals.map((s) => ({ name: s.name, condition: s.condition })),
            }),
          }),
        })

        if (!response.ok || !response.body) {
          const payload: unknown = await response.json().catch(() => null)
          const message =
            typeof payload === 'object' && payload && 'error' in payload
              ? String((payload as { error: unknown }).error)
              : t('ai.error.status', { status: response.status })
          append({ role: 'assistant', content: message, failed: true })
          return
        }

        // The reply renders as it is written; commands run once the stream ends.
        const entry = append({ role: 'assistant', content: '', streaming: true, startedAt: Date.now() })
        let settled = false

        for await (const event of readChatStream(response.body)) {
          if (event.type === 'reply') {
            update(entry.id, { content: event.text })
            continue
          }
          settled = true
          const results = executeCommands(event.commands, candlesRef.current)
          update(entry.id, {
            content: event.reply,
            results,
            mode: event.mode,
            streaming: false,
            ...(event.failed ? { failed: true } : {}),
          })
        }

        if (!settled) {
          update(entry.id, { content: t('ai.error.network'), failed: true, streaming: false })
        }
      } catch (error) {
        console.error('[ai] request failed:', error)
        append({
          role: 'assistant',
          content: t('ai.error.network'),
          failed: true,
        })
      } finally {
        setSending(false)
      }
    },
    [append, update, setSending, t],
  )

  return (
    <aside className="flex h-full min-w-0 flex-col bg-surface" data-ai-busy={isSending || undefined}>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="text-[12px] font-medium text-text">{t('ai.title')}</span>
        <span className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint">
          {t('ai.subtitle')}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            aria-label={t('gallery.open')}
            className="flex items-center gap-1.5 rounded border border-line px-1.5 py-1 text-[10.5px] text-muted transition-colors hover:border-accent/40 hover:text-text"
          >
            <LayoutGrid className="h-3 w-3" />
            {t('gallery.open')}
          </button>
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={reset}
              aria-label={t('ai.clear')}
              className="rounded p-1 text-faint transition-colors hover:text-text"
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="pt-6 text-[12px] leading-relaxed text-muted">
            <p className="text-text">{t('ai.empty.title')}</p>
            <p className="mt-1.5 text-faint">{t('ai.empty.body')}</p>
            <button
              type="button"
              onClick={() => setGalleryOpen(true)}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-line bg-raised px-2.5 py-1.5 text-[11.5px] text-muted transition-colors hover:border-accent/40 hover:text-text"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {t('gallery.open')}
            </button>
          </div>
        ) : null}
        {messages.map((entry) => (
          <ChatMessage key={entry.id} entry={entry} />
        ))}

      </div>

      {messages.length === 0 ? <PromptSuggestions onPick={send} /> : null}

      <CommandGallery open={galleryOpen} onClose={() => setGalleryOpen(false)} onPick={send} />

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void send(draft)
        }}
        className="shrink-0 border-t border-line p-2.5"
      >
        <div className="flex items-end gap-2 rounded-lg border border-line bg-raised px-2.5 py-2 focus-within:border-accent/50">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send(draft)
              }
            }}
            rows={1}
            placeholder={t('ai.placeholder')}
            className="max-h-32 min-h-[22px] w-full resize-none bg-transparent text-[12.5px] leading-relaxed text-text outline-none placeholder:text-faint"
          />
          <button
            type="submit"
            disabled={isSending || draft.trim().length === 0}
            aria-label={t('ai.send')}
            className="shrink-0 rounded-md bg-accent p-1.5 text-base transition-opacity disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
        <p className="pt-1.5 text-center text-[10px] text-faint">
          {t('ai.disclaimer')}
        </p>
      </form>
    </aside>
  )
}
