'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { SYMBOL_CATALOGUE, searchCatalogue } from '@/lib/market/symbols'
import { useChartStore } from '@/stores/chartStore'
import { useT } from '@/stores/localeStore'

export function SymbolSearch() {
  const symbol = useChartStore((s) => s.symbol)
  const setSymbol = useChartStore((s) => s.setSymbol)
  const t = useT()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const matches = searchCatalogue(query)
    const typed = query.trim().toUpperCase()
    // Any ticker can be requested, not just catalogued ones.
    if (typed && !matches.some((m) => m.symbol === typed)) {
      return [{ symbol: typed, name: t('search.useTicker'), kind: 'stock' as const }, ...matches]
    }
    return matches
  }, [query, t])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const commit = (next: string) => {
    setSymbol(next)
    setOpen(false)
  }

  const meta = SYMBOL_CATALOGUE.find((s) => s.symbol === symbol)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex items-center gap-2 rounded-md border border-line bg-raised px-2.5 py-1.5 text-left transition-colors hover:border-line/80 hover:bg-line-soft"
      >
        <Search className="h-3.5 w-3.5 text-faint" />
        <span className="text-[13px] font-semibold tracking-wide text-text">{symbol}</span>
        <span className="hidden max-w-40 truncate text-[11px] text-faint lg:inline">
          {meta?.name ?? t('search.custom')}
        </span>
        <kbd className="ml-1 rounded border border-line px-1 text-[10px] text-faint">⌘K</kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[14vh]"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="animate-in-soft w-full max-w-lg overflow-hidden rounded-lg border border-line bg-surface shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="h-4 w-4 text-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setActive((i) => Math.min(i + 1, results.length - 1))
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setActive((i) => Math.max(i - 1, 0))
                  } else if (event.key === 'Enter') {
                    const picked = results[active]
                    if (picked) commit(picked.symbol)
                  }
                }}
                placeholder={t('search.placeholder')}
                className="w-full bg-transparent py-3 text-sm text-text outline-none placeholder:text-faint"
              />
            </div>
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-faint">{t('search.empty')}</li>
              ) : null}
              {results.map((result, index) => (
                <li key={result.symbol}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => commit(result.symbol)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] ${
                      index === active ? 'bg-raised text-text' : 'text-muted'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-20 font-medium text-text">{result.symbol}</span>
                      <span className="truncate text-[11px] text-faint">{result.name}</span>
                    </span>
                    <span className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint uppercase">
                      {t(result.kind === 'crypto' ? 'search.kind.crypto' : 'search.kind.stock')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  )
}
