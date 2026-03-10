/** @file
 * 許可メール一覧データ取得フック。
 * 入力: headers（認証トークン）、search、status フィルタ。
 * 出力: { data, error, loading, refetch }。
 * 依存: React hooks。
 * セキュリティ: Bearer トークンを headers 経由で送信。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

type AllowedEmailStatus = 'active' | 'pending' | 'revoked'

export type AllowedEmail = {
  email: string
  status: AllowedEmailStatus
  label: string | null
  notes: string | null
  updatedAt?: string
  updatedBy?: string | null
}

type Fetcher = typeof fetch

type UseAllowlistQueryOptions = {
  fetcher?: Fetcher
  headers?: HeadersInit
  search?: string
  status?: AllowedEmailStatus | 'all'
}

export function useAllowlistQuery(options: UseAllowlistQueryOptions = {}) {
  const { fetcher = fetch, headers, search, status = 'all' } = options
  const [data, setData] = useState<AllowedEmail[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)

  const headersKey = headers ? JSON.stringify(headers) : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const headersMemo = useMemo(() => headers, [headersKey])

  const refetch = useCallback(() => setRevision((r) => r + 1), [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        // URLSearchParams を使ってクエリパラメータを構築（相対パスを利用）
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (status && status !== 'all') params.set('status', status)

        const queryValue = params.toString()
        const endpoint = `/api/admin/allowlist${queryValue ? `?${queryValue}` : ''}`

        const res = await fetcher(endpoint, { headers: headersMemo })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error?.message ?? `Failed to load allowlist (${res.status})`)
        }
        const json = await res.json()
        if (!mounted) return
        setData(json.data ?? [])
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
  }, [fetcher, headersMemo, search, status, revision])

  return { data, error, loading, refetch }
}
