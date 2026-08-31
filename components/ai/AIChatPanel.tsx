'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, Eraser } from 'lucide-react'
import type { Candle } from '@/lib/types'
import { AiResponseSchema } from '@/lib/schemas/chartCommand'
import { executeCommands } from '@/lib/chart/commandExecutor'
import { formatDate } from '@/lib/format'
import { useAiStore } from '@/stores/aiStore'
import { useChartStore } from '@/stores/chartStore'
import { ChatMessage } from './ChatMessage'
import { PromptSuggestions } from './PromptSuggestions'

export function AIChatPanel({ candles }: { candles: Candle[] }) {
  const messages = useAiStore((s) => s.messages)
  const isSending = useAiStore((s) => s.isSending)
  const append = useAiStore((s) => s.append)
  const setSending = useAiStore((s) => s.setSending)
  const reset = useAiStore((s) => s.reset)

  const [draft, setDraft] = useState('')
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
      const first = bars[0]
      const last = bars[bars.length - 1]

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: useAiStore
              .getState()
              .messages.slice(-12)
              .map((m) => ({ role: m.role, content: m.content })),
            context: {
              symbol: chart.symbol,
              timeframe: chart.timeframe,
              barCount: bars.length,
              ...(first ? { firstBarDate: formatDate(first.time) } : {}),
              ...(last ? { lastBarDate: formatDate(last.time), lastPrice: last.close } : {}),
              indicators: chart.indicators.map((i) => ({ type: i.type, params: i.params })),
              signals: chart.signals.map((s) => ({ name: s.name, condition: s.condition })),
            },
          }),
        })

        const payload: unknown = await response.json()
        if (!response.ok) {
          const message =
            typeof payload === 'object' && payload && 'error' in payload
              ? String((payload as { error: unknown }).error)
              : `Request failed (${response.status})`
          append({ role: 'assistant', content: message, failed: true })
          return
        }

        const parsed = AiResponseSchema.safeParse(payload)
        if (!parsed.success) {
          append({
            role: 'assistant',
            content: 'The response could not be validated, so nothing was applied to the chart.',
            failed: true,
          })
          return
        }

        const results = executeCommands(parsed.data.commands, candlesRef.current)
        const mode =
          typeof payload === 'object' && payload && 'mode' in payload
            ? String((payload as { mode: unknown }).mode)
            : undefined
        append({
          role: 'assistant',
          content: parsed.data.reply,
          results,
          ...(mode ? { mode } : {}),
        })
      } catch (error) {
        console.error('[ai] request failed:', error)
        append({
          role: 'assistant',
          content: 'Could not reach the analysis service. Check your connection and try again.',
          failed: true,
        })
      } finally {
        setSending(false)
      }
    },
    [append, setSending],
  )

  return (
    <aside className="flex h-full min-w-0 flex-col bg-surface">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="text-[12px] font-medium text-text">AI Analyst</span>
        <span className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint">
          command interface
        </span>
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={reset}
            aria-label="Clear conversation"
            className="ml-auto rounded p-1 text-faint transition-colors hover:text-text"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="pt-6 text-[12px] leading-relaxed text-muted">
            <p className="text-text">Describe what you want to see on the chart.</p>
            <p className="mt-1.5 text-faint">
              Conditions are compiled into a typed command and evaluated against the real candles —
              the model never invents dates or counts.
            </p>
          </div>
        ) : null}
        {messages.map((entry) => (
          <ChatMessage key={entry.id} entry={entry} />
        ))}
        {isSending ? (
          <div className="flex items-center gap-2 text-[11px] text-faint">
            <span className="h-3 w-3 animate-spin rounded-full border border-line border-t-accent" />
            Interpreting…
          </div>
        ) : null}
      </div>

      {messages.length === 0 ? <PromptSuggestions onPick={send} /> : null}

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
            placeholder="e.g. mark days that dropped more than 5%"
            className="max-h-32 min-h-[22px] w-full resize-none bg-transparent text-[12.5px] leading-relaxed text-text outline-none placeholder:text-faint"
          />
          <button
            type="submit"
            disabled={isSending || draft.trim().length === 0}
            aria-label="Send"
            className="shrink-0 rounded-md bg-accent p-1.5 text-base transition-opacity disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
        <p className="pt-1.5 text-center text-[10px] text-faint">
          Analysis tool, not investment advice.
        </p>
      </form>
    </aside>
  )
}
