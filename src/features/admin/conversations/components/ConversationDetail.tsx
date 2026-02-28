/** @file
 * 会話詳細パネル（メッセージ一覧＋添付表示）。
 * 入力: conversationId, headers（認証トークン）。
 * 出力: メッセージバブル + タイムスタンプ + 添付サムネイル。
 * 依存: useConversationDetail フック。
 * セキュリティ: 閲覧専用。Bearer トークンを headers 経由で送信。
 */

'use client'

import { useConversationDetail } from '../hooks/useConversationDetail'

type ConversationDetailProps = {
  conversationId: string
  headers?: HeadersInit
  onClose: () => void
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' })
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

export function ConversationDetail({ conversationId, headers, onClose }: ConversationDetailProps) {
  const { data, error, loading } = useConversationDetail({ conversationId, headers })

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">エラー: {error.message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 text-sm text-indigo-600 hover:underline"
        >
          閉じる
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ヘッダー */}
      <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-slate-900">{data.title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {data.user.displayName ?? data.user.email} &middot; {formatDateTime(data.createdAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-3 shrink-0 text-sm text-slate-400 hover:text-slate-600"
          aria-label="詳細を閉じる"
        >
          &times;
        </button>
      </div>

      {/* メッセージ一覧 */}
      <div className="max-h-[600px] space-y-3 overflow-y-auto p-4">
        {data.messages.length === 0 ? (
          <p className="text-center text-sm text-slate-500">メッセージがありません。</p>
        ) : (
          data.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-50 text-slate-900'
                    : 'bg-slate-100 text-slate-900'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                {/* 添付画像 */}
                {msg.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500"
                      >
                        {att.mimeType ?? 'file'} ({att.sizeBytes ? `${Math.round(att.sizeBytes / 1024)}KB` : '-'})
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-1 text-right text-[10px] text-slate-400">
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
