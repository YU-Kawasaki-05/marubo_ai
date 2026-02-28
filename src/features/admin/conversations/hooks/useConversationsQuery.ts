/** @file
 * GET /api/admin/conversations のデータ取得フック。
 * 入力: headers（認証トークン）、検索パラメータ（email/from/to/keyword/page/limit）。
 * 出力: { data: { conversations, pagination } | null, error, loading }。
 * 依存: React hooks。
 * セキュリティ: Bearer トークンを headers 経由で送信。
 */

import { useEffect, useMemo, useState } from 'react'

export type ConversationUser = {
  email: string
  displayName: string | null
}

export type ConversationListItem = {
  id: string
  title: string
  createdAt: string
  messageCount: number
  user: ConversationUser
}

export type PaginationInfo = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type ConversationsData = {
  conversations: ConversationListItem[]
  pagination: PaginationInfo
}

type Fetcher = typeof fetch

export type ConversationsQueryParams = {
  email?: string
  from?: string
  to?: string
  keyword?: string
  page?: number
  limit?: number
}

type UseConversationsQueryOptions = {
  fetcher?: Fetcher
  headers?: HeadersInit
  params?: ConversationsQueryParams
}

export function useConversationsQuery(options: UseConversationsQueryOptions = {}) {
  const { fetcher = fetch, headers, params } = options
  const [data, setData] = useState<ConversationsData | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const headersKey = headers ? JSON.stringify(headers) : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const headersMemo = useMemo(() => headers, [headersKey])

  const paramsKey = params ? JSON.stringify(params) : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const paramsMemo = useMemo(() => params, [paramsKey])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const sp = new URLSearchParams()
        if (paramsMemo?.email) sp.set('email', paramsMemo.email)
        if (paramsMemo?.from) sp.set('from', paramsMemo.from)
        if (paramsMemo?.to) sp.set('to', paramsMemo.to)
        if (paramsMemo?.keyword) sp.set('keyword', paramsMemo.keyword)
        if (paramsMemo?.page) sp.set('page', String(paramsMemo.page))
        if (paramsMemo?.limit) sp.set('limit', String(paramsMemo.limit))

        const qs = sp.toString()
        const endpoint = `/api/admin/conversations${qs ? `?${qs}` : ''}`
        const res = await fetcher(endpoint, { headers: headersMemo })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error?.message ?? `会話一覧の取得に失敗しました (${res.status})`)
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
  }, [fetcher, headersMemo, paramsMemo])

  return { data, error, loading }
}
