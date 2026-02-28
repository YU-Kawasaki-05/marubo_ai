/** @file
 * GET /api/admin/conversations/[id] のデータ取得フック。
 * 入力: headers（認証トークン）、conversationId。
 * 出力: { data: ConversationDetail | null, error, loading }。
 * 依存: React hooks。
 * セキュリティ: Bearer トークンを headers 経由で送信。
 */

import { useEffect, useMemo, useState } from 'react'

export type MessageAttachment = {
  id: string
  storagePath: string
  mimeType: string | null
  sizeBytes: number | null
}

export type MessageDetail = {
  id: string
  role: string
  content: string
  createdAt: string
  attachments: MessageAttachment[]
}

export type ConversationDetail = {
  id: string
  title: string
  createdAt: string
  user: {
    email: string
    displayName: string | null
  }
  messages: MessageDetail[]
}

type Fetcher = typeof fetch

type UseConversationDetailOptions = {
  fetcher?: Fetcher
  headers?: HeadersInit
  conversationId: string | null
}

export function useConversationDetail(options: UseConversationDetailOptions) {
  const { fetcher = fetch, headers, conversationId } = options
  const [data, setData] = useState<ConversationDetail | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  const headersKey = headers ? JSON.stringify(headers) : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const headersMemo = useMemo(() => headers, [headersKey])

  useEffect(() => {
    if (!conversationId) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetcher(`/api/admin/conversations/${conversationId}`, {
          headers: headersMemo,
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error?.message ?? `会話詳細の取得に失敗しました (${res.status})`)
        }

        const json = await res.json()
        if (!mounted) return
        setData(json.data ?? null)
      } catch (err) {
        if (!mounted) return
        setError(err as Error)
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [fetcher, headersMemo, conversationId])

  return { data, error, loading }
}
