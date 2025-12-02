import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Marubo AI',
  description: '塾向けチャットボット（β）',
}

type RootLayoutProps = {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
