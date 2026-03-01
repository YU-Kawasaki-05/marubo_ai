/** @file
 * `/reports` 生徒向け月次レポートページ。
 * 入力: Supabase セッション（Bearer トークン）。
 * 出力: 月選択 + 記事風レポート表示 UI。
 * 依存: useStudentReport, MonthSelector, ReportContent, Supabase Browser Client。
 * セキュリティ: AllowlistGuard + API 側で自分のレポートのみ返却。
 */

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { AllowlistGuard } from '../../src/features/allowlist/components/AllowlistGuard'
import { MonthSelector } from '../../src/features/reports/components/MonthSelector'
import { ReportContent } from '../../src/features/reports/components/ReportContent'
import { useStudentReport } from '../../src/features/reports/hooks/useStudentReport'
import { getSupabaseBrowserClient } from '../../src/shared/lib/supabaseClient'

function getCurrentMonth(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const y = jst.getUTCFullYear()
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export default function ReportsPage() {
  const [token, setToken] = useState<string | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null)
      setIsCheckingSession(false)
    })
  }, [])

  const headers = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : undefined
  }, [token])

  const { data, loading, error } = useStudentReport({
    headers,
    month: selectedMonth,
  })

  if (isCheckingSession) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-slate-600">読み込み中...</p>
      </main>
    )
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold text-slate-900">学習レポート</h1>
        <p className="mt-4 text-red-600">ログインが必要です。</p>
        <Link href="/login" className="text-indigo-600 underline">
          ログイン画面へ
        </Link>
      </main>
    )
  }

  return (
    <AllowlistGuard redirectToHome={false}>
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        {/* ヘッダー */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">学習レポート</h1>
            <p className="text-sm text-slate-600">
              月ごとの学習傾向と AI からのアドバイスを確認できます。
            </p>
          </div>
          <Link href="/chat" className="text-sm text-indigo-600 hover:underline">
            チャットへ戻る
          </Link>
        </header>

        {/* 月選択 */}
        <section className="flex items-center gap-3">
          <label htmlFor="month-select" className="text-sm font-medium text-slate-700">
            対象月:
          </label>
          <MonthSelector selectedMonth={selectedMonth} onChange={setSelectedMonth} />
        </section>

        {/* レポート表示 */}
        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-500">レポートを読み込み中...</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-red-700">エラー: {error.message}</p>
          </div>
        )}

        {!loading && !error && data?.report && (
          <ReportContent report={data.report} />
        )}

        {!loading && !error && !data?.report && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-lg font-medium text-slate-700">
              この月のレポートはまだ生成されていません
            </p>
            <p className="mt-2 text-sm text-slate-500">
              月末にレポートが自動生成されます。AI チャットをたくさん活用してみてください。
            </p>
          </div>
        )}
      </main>
    </AllowlistGuard>
  )
}
