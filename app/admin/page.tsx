/** @file
 * `/admin` 管理ダッシュボードページ。
 * 入力: Supabase セッション（クライアントサイドで token チェック）。
 * 出力: 4 つの管理機能へのカードリンク UI。
 * 依存: Supabase Browser Client, LogoutButton。
 * セキュリティ: Middleware でスタッフロールを検証済み。クライアント側でもセッション有無を確認。
 */

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { LogoutButton } from '../../src/shared/components/LogoutButton'
import { getSupabaseBrowserClient } from '../../src/shared/lib/supabaseClient'

const adminLinks = [
  {
    href: '/admin/allowlist',
    title: '許可リスト管理',
    description: '登録メールアドレスの追加・ステータス変更・CSV インポートを行います。',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/admin/grant',
    title: '権限管理',
    description: 'スタッフ権限の付与・解除と操作履歴を確認します。',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    href: '/admin/conversations',
    title: '会話検索',
    description: '生徒の会話履歴を検索・閲覧します。',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    href: '/admin/reports',
    title: 'レポート管理',
    description: '月次レポートの生成・確認・CSV ダウンロードを行います。',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
]

export default function AdminDashboardPage() {
  const [token, setToken] = useState<string | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null)
      setIsCheckingSession(false)
    })
  }, [])

  if (isCheckingSession) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-bold">管理ダッシュボード</h1>
        <p className="mt-4 text-slate-600">読み込み中...</p>
      </main>
    )
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-bold">管理ダッシュボード</h1>
        <p className="mt-4 text-red-600">ログインが必要です。</p>
        <Link href="/login" className="text-indigo-600 underline">
          ログイン画面へ
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-slate-500">Admin</p>
          <h1 className="text-2xl font-bold text-slate-900">管理ダッシュボード</h1>
          <p className="text-sm text-slate-600">各管理機能にアクセスできます。</p>
        </div>
        <div className="flex items-center gap-4">
          <LogoutButton />
          <Link href="/" className="text-sm text-indigo-600 hover:underline">
            戻る
          </Link>
        </div>
      </header>

      {/* TODO: 統計サマリー（アクティブユーザー数等）は統計 API 実装後に追加 */}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {adminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
                {link.icon}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{link.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{link.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
