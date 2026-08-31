'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Lock, Search, X } from 'lucide-react'
import { COMMAND_CATALOGUE, type CatalogueEntry } from '@/lib/ai/commandCatalogue'
import { useChartStore } from '@/stores/chartStore'
import { useLocale, useT } from '@/stores/localeStore'

type Props = { open: boolean; onClose: () => void; onPick: (prompt: string) => void }

export function CommandGallery({ open, onClose, onPick }: Props) {
  const locale = useLocale()
  const t = useT()
  const hasSignal = useChartStore((s) => s.signals.length > 0)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    requestAnimationFrame(() => inputRef.current?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return COMMAND_CATALOGUE.map((group) => ({
      ...group,
      entries: needle
        ? group.entries.filter((e) =>
            `${e.prompt[locale]} ${e.effect[locale]} ${e.produces}`.toLowerCase().includes(needle),
          )
        : group.entries,
    })).filter((group) => group.entries.length > 0)
  }, [query, locale])

  const total = groups.reduce((sum, g) => sum + g.entries.length, 0)

  if (!open) return null

  const run = (entry: CatalogueEntry) => {
    onClose()
    onPick(entry.prompt[locale])
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 pt-[8vh]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-label={t('gallery.title')}
        className="animate-in-soft flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-medium text-text">{t('gallery.title')}</h2>
            <p className="mt-0.5 text-[11px] text-faint">{t('gallery.subtitle')}</p>
          </div>
          <span className="mt-0.5 shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] tnum text-faint">
            {t('gallery.count', { count: total })}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('gallery.close')}
            className="mt-0.5 shrink-0 rounded p-1 text-faint transition-colors hover:text-text"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-b border-line px-4">
          <Search className="h-3.5 w-3.5 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('gallery.search')}
            className="w-full bg-transparent py-2.5 text-[12.5px] text-text outline-none placeholder:text-faint"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {groups.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-faint">{t('gallery.empty')}</p>
          ) : null}

          {groups.map((group) => (
            <section key={group.id} className="mb-4 last:mb-1">
              <h3 className="pb-1.5 text-[10.5px] tracking-wide text-faint uppercase">
                {group.title[locale]}
              </h3>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {group.entries.map((entry) => {
                  const blocked = entry.requires === 'signal' && !hasSignal
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => run(entry)}
                        title={blocked ? t('gallery.needsSignal') : undefined}
                        className={`group flex h-full w-full flex-col items-start gap-1 rounded-md border border-line bg-raised px-3 py-2 text-left transition-colors ${
                          blocked
                            ? 'cursor-not-allowed opacity-45'
                            : 'hover:border-accent/45 hover:bg-line-soft'
                        }`}
                      >
                        <span className="flex w-full items-start gap-1.5">
                          {blocked ? <Lock className="mt-0.5 h-3 w-3 shrink-0 text-faint" /> : null}
                          <span className="text-[12px] leading-snug text-text">
                            {entry.prompt[locale]}
                          </span>
                        </span>
                        <span className="text-[10.5px] leading-snug text-faint">
                          {blocked ? t('gallery.needsSignal') : entry.effect[locale]}
                        </span>
                        <span className="mt-auto pt-1 font-mono text-[9.5px] tracking-tight text-faint/70">
                          {entry.produces}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
