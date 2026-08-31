import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'ChartPilot — AI-native financial charts',
  description:
    'Command a financial chart in plain language. Conditions are evaluated by a deterministic analysis engine, not by the model.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
