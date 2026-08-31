'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  // Read the saved language after mount so the server and first paint agree on the default.
  useEffect(() => {
    useLocaleStore.getState().hydrate()
  }, [])

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
