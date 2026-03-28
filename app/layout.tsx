import type { Metadata, Viewport } from 'next'

import { AccountStatusBanner } from '../src/features/allowlist/components/AccountStatusBanner'
import './globals.css'
import 'katex/dist/katex.min.css'

export const metadata: Metadata = {
  title: 'Marubo AI',
  description: '塾向けチャットボット（β）',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

type RootLayoutProps = {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body>
        <AccountStatusBanner />
        {children}
      </body>
    </html>
  )
}
