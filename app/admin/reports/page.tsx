/** @file
 * `/admin/reports` スタッフ用月次レポート管理ページ。
 * 入力: Supabase セッション（Bearer トークン）。
 * 出力: 操作パネル（生成/dry-run/CSV DL）+ レポート一覧テーブル + ページネーション + レポート詳細パネル。
 * 依存: useReportsQuery, useReportsMutation, MonthSelector, ReportContent, Supabase Browser Client。
 * セキュリティ: requireStaff() で API 側で認可チェック。
 */

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { useReportsMutation } from '../../../src/features/admin/reports/hooks/useReportsMutation'
import {
  useReportsQuery,
  type ReportsQueryParams,
} from '../../../src/features/admin/reports/hooks/useReportsQuery'
import { MonthSelector } from '../../../src/features/reports/components/MonthSelector'
import { ReportContent } from '../../../src/features/reports/components/ReportContent'
import type { StudentReport } from '../../../src/features/reports/hooks/useStudentReport'
import { ConfirmDialog } from '../../../src/shared/components/ConfirmDialog'
import { LogoutButton } from '../../../src/shared/components/LogoutButton'
import { getSupabaseBrowserClient } from '../../../src/shared/lib/supabaseClient'

type DialogState = {
  open: boolean
  title: string
  message: string
  variant?: 'default' | 'destructive'
  confirmLabel?: string
  cancelLabel?: string | null
  onConfirm: () => void
}

function getCurrentMonth(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const y = jst.getUTCFullYear()
  const m = jst.getUTCMonth() + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type StatusBadgeProps = { status: string }

function StatusBadge({ status }: StatusBadgeProps) {
  const map: Record<string, { label: string; className: string }> = {
    generated: { label: '生成済み', className: 'bg-green-50 text-green-700' },
    failed: { label: '失敗', className: 'bg-red-50 text-red-700' },
    generating: { label: '生成中', className: 'bg-yellow-50 text-yellow-700' },
    pending: { label: '未生成', className: 'bg-slate-100 text-slate-600' },
  }
  const badge = map[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' }

  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}>
      {badge.label}
    </span>
  )
}

export default function AdminReportsPage() {
  const [token, setToken] = useState<string | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [page, setPage] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [dialog, setDialog] = useState<DialogState>({
    open: false, title: '', message: '', onConfirm: () => {},
  })

  // レポート詳細パネル
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedUserLabel, setSelectedUserLabel] = useState('')
  const [detailReport, setDetailReport] = useState<StudentReport | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const closeDialog = () => setDialog((prev) => ({ ...prev, open: false }))

  const showAlert = (title: string, message: string) => {
    setDialog({ open: true, title, message, cancelLabel: null, onConfirm: closeDialog })
  }

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

  const queryParams = useMemo<ReportsQueryParams>(
    () => ({ month: selectedMonth, page }),
    [selectedMonth, page],
  )

  const { data, loading, error, refetch } = useReportsQuery({ headers, params: queryParams })
  const { generateReports, regenerateReport, downloadCsv } = useReportsMutation({ headers })

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month)
    setPage(1)
    setSelectedUserId(null)
    setDetailReport(null)
  }

  const handleViewReport = async (userId: string, userLabel: string) => {
    // 同じユーザーを再度クリック → 閉じる
    if (selectedUserId === userId) {
      setSelectedUserId(null)
      setDetailReport(null)
      return
    }

    setSelectedUserId(userId)
    setSelectedUserLabel(userLabel)
    setDetailLoading(true)
    setDetailReport(null)

    try {
      const url = `/api/reports/monthly?month=${encodeURIComponent(selectedMonth)}&userId=${encodeURIComponent(userId)}&detail=true`
      const res = await fetch(url, { headers: headers as HeadersInit })
      if (!res.ok) throw new Error(`レポート詳細の取得に失敗しました (${res.status})`)
      const json = await res.json()
      setDetailReport(json.data?.report ?? null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '予期せぬエラーが発生しました'
      showAlert('エラー', msg)
      setSelectedUserId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleCloseDetail = () => {
    setSelectedUserId(null)
    setDetailReport(null)
  }

  const handleDryRun = () => {
    setDialog({
      open: true,
      title: 'Dry Run の確認',
      message: `${selectedMonth} のレポートを Dry Run（プレビュー）しますか？`,
      confirmLabel: '実行する',
      onConfirm: async () => {
        closeDialog()
        setGenerating(true)
        try {
          const result = await generateReports(selectedMonth, true)
          showAlert(
            'Dry Run 完了',
            `対象ユーザー数: ${result?.targetCount ?? '-'}\nスキップ: ${result?.skippedCount ?? '-'}`,
          )
          refetch()
        } catch (err) {
          const msg = err instanceof Error ? err.message : '予期せぬエラーが発生しました'
          showAlert('エラー', msg)
        } finally {
          setGenerating(false)
        }
      },
    })
  }

  const handleGenerate = () => {
    setDialog({
      open: true,
      title: '一括生成の確認',
      message: `${selectedMonth} のレポートを一括生成しますか？\n（LLM 分析を含むため数分かかる場合があります）`,
      confirmLabel: '生成する',
      onConfirm: async () => {
        closeDialog()
        setGenerating(true)
        try {
          const result = await generateReports(selectedMonth, false)
          showAlert(
            '生成完了',
            `成功: ${result?.successCount ?? '-'}\n失敗: ${result?.failedCount ?? '-'}\nスキップ: ${result?.skippedCount ?? '-'}`,
          )
          refetch()
        } catch (err) {
          const msg = err instanceof Error ? err.message : '予期せぬエラーが発生しました'
          showAlert('エラー', msg)
        } finally {
          setGenerating(false)
        }
      },
    })
  }

  const handleRegenerate = (userId: string, email: string, status: string) => {
    const isOverwrite = status === 'generated'
    setDialog({
      open: true,
      title: isOverwrite ? '再生成（上書き）の確認' : '再生成の確認',
      message: isOverwrite
        ? `${email} のレポートは既に生成済みです。上書きして再生成しますか？`
        : `${email} のレポートを再生成しますか？`,
      variant: isOverwrite ? 'destructive' : 'default',
      confirmLabel: isOverwrite ? '上書き再生成する' : '再生成する',
      onConfirm: async () => {
        closeDialog()
        setGenerating(true)
        try {
          await regenerateReport(selectedMonth, userId)
          showAlert('完了', '再生成が完了しました。')
          refetch()
        } catch (err) {
          const msg = err instanceof Error ? err.message : '予期せぬエラーが発生しました'
          showAlert('エラー', msg)
        } finally {
          setGenerating(false)
        }
      },
    })
  }

  const handleCsvDownload = async () => {
    try {
      await downloadCsv(selectedMonth)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '予期せぬエラーが発生しました'
      showAlert('エラー', msg)
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  // ── 条件レンダリング ──

  if (isCheckingSession || (loading && !error && !data)) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold">月次レポート管理</h1>
        <p className="mt-4 text-slate-600">読み込み中...</p>
      </main>
    )
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold">月次レポート管理</h1>
        <p className="mt-4 text-red-600">ログインが必要です。</p>
        <Link href="/login" className="text-indigo-600 underline">
          ログイン画面へ
        </Link>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold">月次レポート管理</h1>
        <p className="mt-4 text-red-600">エラー: {error.message}</p>
      </main>
    )
  }

  const reports = data?.reports ?? []
  const pagination = data?.pagination

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-slate-500">Reports</p>
          <h1 className="text-2xl font-bold text-slate-900">月次レポート管理</h1>
          <p className="text-sm text-slate-600">
            全生徒の月次レポートを確認・生成・ダウンロードします。
          </p>
        </div>
        <div className="flex items-center gap-4">
          <LogoutButton />
          <Link href="/admin" className="text-sm text-indigo-600 hover:underline">
            戻る
          </Link>
        </div>
      </header>

      {/* セクション 1: 操作パネル */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">操作パネル</h2>
        <p className="mt-1 text-sm text-slate-600">
          対象月を選択し、レポートの生成やダウンロードを行います。
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">対象月</label>
            <div className="mt-1">
              <MonthSelector selectedMonth={selectedMonth} onChange={handleMonthChange} />
            </div>
          </div>
          <button
            type="button"
            onClick={handleDryRun}
            disabled={generating}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {generating ? '処理中...' : 'Dry Run'}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating ? '生成中...' : '一括生成'}
          </button>
          <button
            type="button"
            onClick={handleCsvDownload}
            disabled={generating}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            CSV ダウンロード
          </button>
        </div>
      </section>

      {/* セクション 2: レポート一覧テーブル */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-slate-700">レポート一覧</h2>
            <p className="text-2xl font-bold text-slate-900">
              {pagination?.total ?? 0}
              <span className="ml-1 text-sm font-normal text-slate-500">件</span>
            </p>
          </div>
          {loading && <p className="text-sm text-slate-500">読み込み中...</p>}
        </div>

        {reports.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            該当するレポートがありません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">メール</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">表示名</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">ステータス</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">質問数</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">会話数</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">生成日時</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {reports.map((report) => {
                  const stats = report.stats as Record<string, number> | null
                  return (
                    <tr key={report.id}>
                      <td className="px-4 py-2 text-slate-900">{report.user.email}</td>
                      <td className="px-4 py-2 text-slate-600">
                        {report.user.displayName ?? '-'}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="px-4 py-2 text-right text-slate-600">
                        {stats?.questions ?? '-'}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-600">
                        {stats?.conversations ?? '-'}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {report.generatedAt ? formatDateTime(report.generatedAt) : '-'}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {report.status === 'generated' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleViewReport(
                                  report.userId,
                                  report.user.displayName || report.user.email,
                                )
                              }
                              disabled={detailLoading && selectedUserId === report.userId}
                              className={`rounded border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                                selectedUserId === report.userId
                                  ? 'border-blue-400 bg-blue-100 text-blue-800'
                                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                              }`}
                            >
                              {detailLoading && selectedUserId === report.userId
                                ? '読込中...'
                                : '閲覧'}
                            </button>
                          )}
                          {(report.status === 'failed' || report.status === 'generated') && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRegenerate(report.userId, report.user.email, report.status)
                              }
                              disabled={generating}
                              className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                            >
                              再生成
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ページネーション */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <button
              type="button"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              &larr; 前へ
            </button>
            <p className="text-sm text-slate-600">
              {pagination.page} / {pagination.totalPages} ページ
            </p>
            <button
              type="button"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              次へ &rarr;
            </button>
          </div>
        )}
      </section>
      {/* セクション 3: レポート詳細パネル */}
      {selectedUserId && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium text-slate-700">レポート詳細</h2>
              <p className="text-sm text-slate-600">{selectedUserLabel}</p>
            </div>
            <button
              type="button"
              onClick={handleCloseDetail}
              className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              閉じる
            </button>
          </div>
          <div className="p-4">
            {detailLoading && (
              <p className="py-8 text-center text-slate-500">読み込み中...</p>
            )}
            {!detailLoading && !detailReport && (
              <p className="py-8 text-center text-slate-500">レポートが見つかりませんでした。</p>
            )}
            {!detailLoading && detailReport && (
              <ReportContent report={detailReport} />
            )}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.confirmLabel}
        cancelLabel={dialog.cancelLabel}
        variant={dialog.variant}
        onConfirm={dialog.onConfirm}
        onCancel={closeDialog}
      />
    </main>
  )
}
