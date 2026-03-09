'use client'

import { useCallback, useEffect, useState } from 'react'

import { ConfirmDialog } from '@shared/components/ConfirmDialog'
import type { Database } from '@shared/types/database'

type Conversation = Database['public']['Tables']['conversations']['Row']

interface ConversationSidebarProps {
  token: string
  selectedId?: string
  onSelect: (id: string) => void
}

export function ConversationSidebar({
  token,
  selectedId,
  onSelect,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/conversations/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error('削除に失敗しました')
      }
      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      if (selectedId === deleteTarget.id) {
        onSelect('')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }, [deleteTarget, token, selectedId, onSelect])

  const fetchConversations = async (cursor?: string) => {
    if (!token) return
    setLoading(true)
    setError(null)

    try {
      const url = new URL('/api/conversations', window.location.href)
      url.searchParams.set('limit', '20')
      if (cursor) {
        url.searchParams.set('cursor', cursor)
      }

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        throw new Error('Failed to fetch conversations')
      }

      const data = await res.json()
      // API response: { data: Conversation[], nextCursor: string | null }
      const list: Conversation[] = Array.isArray(data?.data) ? data.data : []
      setConversations((prev) => (cursor ? [...prev, ...list] : list))
      setNextCursor(data?.nextCursor ?? null)
      setHasMore(!!data?.nextCursor)
    } catch (err) {
      console.error(err)
      setError('履歴の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // 初回マウント時、またはtokenが変わったときに読み込み
  useEffect(() => {
    fetchConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // 親コンポーネントから新規会話などでリストを更新したい場合のための露出メソッドが必要かもしれないが、
  // シンプルにするため、一旦エフェクトのみ。リスト更新は page.tsx 側で key 更新などで制御するか、
  // あるいはここで自動更新ロジックを入れるか。
  // 今回の要件「新規送信すると会話が更新され、サイドバーの選択が該当 ID に揃う」
  // これを実現するには、conversations state を更新する仕組みが必要だが、
  // 一番簡単なのは、props に `lastUpdated` みたいな timestamp を受け取ってリロードすること。
  // まとりあえず基本実装。

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays < 7) {
      return `${diffDays}日前`
    } else {
      return d.toLocaleDateString()
    }
  }

  return (
    <div className="flex h-full flex-col border-r bg-gray-50">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-sm font-bold text-gray-700">会話履歴</h2>
        <button
          type="button"
          onClick={() => onSelect('')} // 新規作成
          className="text-xs text-blue-600 hover:underline"
        >
          新規チャット
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="p-4 text-xs text-red-500 text-center">
            {error}
            <button 
              type="button"
              onClick={() => fetchConversations()}
              className="mt-2 text-blue-500 underline"
            >
              再試行
            </button>
          </div>
        )}

        <ul className="divide-y divide-gray-100">
          {conversations.map((conv) => (
            <li key={conv.id} className="group relative">
              <button
                type="button"
                onClick={() => onSelect(conv.id)}
                className={`w-full p-4 pr-10 text-left hover:bg-gray-100 transition-colors ${
                  selectedId === conv.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
              >
                <div className="truncate text-sm font-medium text-gray-900">
                  {conv.title || '無題の会話'}
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {formatDate(conv.created_at)}
                </div>
              </button>
              <button
                type="button"
                aria-label="会話を削除"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteTarget({ id: conv.id, title: conv.title || '無題の会話' })
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {loading && (
          <div className="p-4 text-center text-xs text-gray-400">
            読み込み中...
          </div>
        )}

        {!loading && hasMore && (
          <button
            type="button"
            onClick={() => fetchConversations(nextCursor!)}
            className="w-full p-3 text-xs text-blue-600 hover:bg-gray-100 text-center"
          >
            もっと読む
          </button>
        )}
        
        {!loading && conversations.length === 0 && !error && (
          <div className="p-8 text-center text-xs text-gray-400">
            履歴はありません
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="会話の削除"
        message={`「${deleteTarget?.title ?? ''}」を削除しますか？\nこの操作は取り消せません。`}
        confirmLabel="削除する"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
