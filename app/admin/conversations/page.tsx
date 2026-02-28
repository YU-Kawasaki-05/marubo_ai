/** @file
 * `/admin/conversations` 会話検索・閲覧ページ。
 * 入力: Supabase セッション（Bearer トークン）。
 * 出力: 検索フィルタ + 一覧テーブル + ページネーション + 詳細パネル。
 * 依存: useConversationsQuery, ConversationSearchForm, ConversationDetail, Supabase Browser Client。
 * セキュリティ: requireStaff() で API 側で認可チェック。閲覧専用。
 */

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { ConversationDetail } from '../../../src/features/admin/conversations/components/ConversationDetail'
import { ConversationSearchForm } from '../../../src/features/admin/conversations/components/ConversationSearchForm'
import {
  useConversationsQuery,
  type ConversationsQueryParams,
} from '../../../src/features/admin/conversations/hooks/useConversationsQuery'
import { getSupabaseBrowserClient } from '../../../src/shared/lib/supabaseClient'

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

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text
}

export default function ConversationsPage() {
  const [token, setToken] = useState<string | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [searchParams, setSearchParams] = useState<ConversationsQueryParams>({ page: 1 })
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  const { data, loading, error } = useConversationsQuery({ headers, params: searchParams })

  const handleSearch = (params: ConversationsQueryParams) => {
    setSearchParams(params)
    setSelectedId(null)
  }

  const handlePageChange = (page: number) => {
    setSearchParams((prev) => ({ ...prev, page }))
  }

  if (isCheckingSession || (loading && !error && !data)) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold">会話検索</h1>
        <p className="mt-4 text-slate-600">読み込み中...</p>
      </main>
    )
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold">会話検索</h1>
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
        <h1 className="text-2xl font-bold">会話検索</h1>
        <p className="mt-4 text-red-600">エラー: {error.message}</p>
      </main>
    )
  }

  const conversations = data?.conversations ?? []
  const pagination = data?.pagination

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-slate-500">Conversations</p>
          <h1 className="text-2xl font-bold text-slate-900">会話検索</h1>
          <p className="text-sm text-slate-600">全生徒の会話を検索・閲覧します。</p>
        </div>
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          戻る
        </Link>
      </header>

      {/* 検索フィルタ */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">検索フィルタ</h2>
        <div className="mt-4">
          <ConversationSearchForm onSearch={handleSearch} disabled={loading} />
        </div>
      </section>

      {/* 検索結果一覧 */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-slate-700">検索結果</h2>
            <p className="text-2xl font-bold text-slate-900">
              {pagination?.total ?? 0}
              <span className="ml-1 text-sm font-normal text-slate-500">件</span>
            </p>
          </div>
          {loading && <p className="text-sm text-slate-500">検索中...</p>}
        </div>

        {conversations.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            該当する会話がありません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">生徒</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">タイトル</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">作成日</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">件数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {conversations.map((conv) => (
                  <tr
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={`cursor-pointer hover:bg-slate-50 ${
                      selectedId === conv.id ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <td className="px-4 py-2 text-slate-900">
                      {conv.user.displayName ?? conv.user.email}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {truncate(conv.title, 50)}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {formatDateTime(conv.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {conv.messageCount}
                    </td>
                  </tr>
                ))}
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

      {/* 会話詳細パネル */}
      {selectedId && (
        <section>
          <ConversationDetail
            conversationId={selectedId}
            headers={headers}
            onClose={() => setSelectedId(null)}
          />
        </section>
      )}
    </main>
  )
}
