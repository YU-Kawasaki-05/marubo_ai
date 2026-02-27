/** @file
 * `/admin/grant` スタッフ権限管理ページ。
 * 入力: Supabase セッション（Bearer トークン）。
 * 出力: 権限付与フォーム、スタッフ一覧、操作履歴の 3 セクション UI。
 * 依存: useGrantQuery, useGrantMutation, Supabase Browser Client。
 * セキュリティ: GRANT_ALLOWED_EMAILS に含まれるスタッフのみ操作可能（API 側で制御）。
 */

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { useGrantMutation } from '../../../src/features/admin/grant/hooks/useGrantMutation'
import { useGrantQuery } from '../../../src/features/admin/grant/hooks/useGrantQuery'
import { getSupabaseBrowserClient } from '../../../src/shared/lib/supabaseClient'

export default function GrantPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [token, setToken] = useState<string | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

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

  const { data, loading, error } = useGrantQuery({ headers })
  const { grantRole, revokeRole } = useGrantMutation({ headers })

  if (isCheckingSession || (loading && !error)) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-bold">スタッフ権限管理</h1>
        <p className="mt-4 text-slate-600">読み込み中...</p>
      </main>
    )
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-bold">スタッフ権限管理</h1>
        <p className="mt-4 text-red-600">ログインが必要です。</p>
        <Link href="/login" className="text-indigo-600 underline">
          ログイン画面へ
        </Link>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-bold">スタッフ権限管理</h1>
        <p className="mt-4 text-red-600">エラー: {error.message}</p>
      </main>
    )
  }

  const handleGrant = async () => {
    const trimmed = email.trim()
    if (!trimmed) return

    if (!window.confirm(`${trimmed} にスタッフ権限を付与しますか？`)) return

    setSubmitting(true)
    try {
      await grantRole(trimmed)
      alert('付与しました。対象ユーザーは再ログインが必要です。')
      setEmail('')
      window.location.reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : '予期せぬエラーが発生しました'
      alert(`エラー: ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevoke = async (targetEmail: string) => {
    if (!window.confirm(`${targetEmail} のスタッフ権限を解除しますか？`)) return

    try {
      await revokeRole(targetEmail)
      alert('権限を解除しました。対象ユーザーは再ログインが必要です。')
      window.location.reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : '予期せぬエラーが発生しました'
      alert(`エラー: ${message}`)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-slate-500">Grant</p>
          <h1 className="text-2xl font-bold text-slate-900">スタッフ権限管理</h1>
          <p className="text-sm text-slate-600">スタッフ権限の付与・解除を行います。</p>
        </div>
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          戻る
        </Link>
      </header>

      {/* セクション 1: 権限付与フォーム */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">権限付与</h2>
        <p className="mt-1 text-sm text-slate-600">
          メールアドレスを入力してスタッフ権限を付与します。
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="grant-email" className="block text-sm font-medium text-slate-700">
              メールアドレス
            </label>
            <input
              id="grant-email"
              type="email"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              disabled={submitting}
            />
          </div>
          <button
            type="button"
            onClick={handleGrant}
            disabled={submitting || !email.trim()}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? '処理中...' : '付与する'}
          </button>
        </div>
      </section>

      {/* セクション 2: 現在のスタッフ一覧 */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-slate-700">現在のスタッフ</h2>
            <p className="text-2xl font-bold text-slate-900">
              {data?.staffUsers.length ?? 0}
              <span className="ml-1 text-sm font-normal text-slate-500">名</span>
            </p>
          </div>
        </div>

        {data?.staffUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            スタッフが登録されていません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">メール</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">表示名</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">登録日</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {data?.staffUsers.map((user) => (
                  <tr key={user.email}>
                    <td className="px-4 py-2 text-slate-900">{user.email}</td>
                    <td className="px-4 py-2 text-slate-600">{user.displayName ?? '-'}</td>
                    <td className="px-4 py-2 text-slate-600">{formatDate(user.grantedAt)}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => handleRevoke(user.email)}
                        className="rounded border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        解除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* セクション 3: 操作履歴 */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-medium text-slate-700">操作履歴</h2>
        </div>

        {data?.auditLog.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            操作履歴がありません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">日時</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">操作者</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">対象</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {data?.auditLog.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2 text-slate-600">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-2 text-slate-900">{log.operatorEmail}</td>
                    <td className="px-4 py-2 text-slate-900">{log.targetEmail}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                          log.action === 'grant'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {log.action === 'grant' ? '付与' : '解除'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
