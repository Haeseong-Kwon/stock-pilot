'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useChartStore } from '@/stores/chartStore'
import { useLocaleStore } from '@/stores/localeStore'

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )
  // Read saved preferences after mount so the server and first paint agree on defaults.
  useEffect(() => {
    useLocaleStore.getState().hydrate()
    useChartStore.getState().hydrate()
  }, [])

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
