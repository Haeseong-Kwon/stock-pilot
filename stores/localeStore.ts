'use client'

import { useMemo } from 'react'
import { create } from 'zustand'
import { isLocale, translator, type Locale, type Translate } from '@/lib/i18n/messages'

const STORAGE_KEY = 'chartpilot.locale'

type LocaleState = {
  locale: Locale
  setLocale: (locale: Locale) => void
  /** Reads the stored preference after mount, so SSR and first paint agree on `ko`. */
  hydrate: () => void
}

export const useLocaleStore = create<LocaleState>()((set) => ({
  locale: 'ko',
  setLocale: (locale) => {
    set({ locale })
    try {
      window.localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // Private mode or blocked storage: the choice just does not persist.
    }
  },
  hydrate: () => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (isLocale(stored)) set({ locale: stored })
    } catch {
      // Ignore — keep the default.
    }
  },
}))

export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale)
}

export function useT(): Translate {
  const locale = useLocale()
  return useMemo(() => translator(locale), [locale])
}
