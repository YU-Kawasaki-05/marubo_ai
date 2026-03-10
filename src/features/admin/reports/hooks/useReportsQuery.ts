/** @file
 * GET /api/reports/monthly のデータ取得フック。
 * 入力: headers（認証トークン）、params（month, page）。
 * 出力: { data: { reports, pagination } | null, error, loading }。
 * 依存: React hooks。
 * セキュリティ: Bearer トークンを headers 経由で送信。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

export type ReportUser = {
  email: string
  displayName: string | null
}

export type ReportListItem = {
  id: string
  userId: string
  month: string
  status: string
  generatedAt: string | null
  user: ReportUser
  stats: unknown
}

export type PaginationInfo = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type ReportsData = {
  reports: ReportListItem[]
  pagination: PaginationInfo
}

export type ReportsQueryParams = {
  month: string
  page?: number
}

type Fetcher = typeof fetch

type UseReportsQueryOptions = {
  fetcher?: Fetcher
  headers?: HeadersInit
  params?: ReportsQueryParams
}

export function useReportsQuery(options: UseReportsQueryOptions = {}) {
  const { fetcher = fetch, headers, params } = options
  const [data, setData] = useState<ReportsData | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)

  const headersKey = headers ? JSON.stringify(headers) : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const headersMemo = useMemo(() => headers, [headersKey])

  const paramsKey = params ? JSON.stringify(params) : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const paramsMemo = useMemo(() => params, [paramsKey])

  const refetch = useCallback(() => setRevision((r) => r + 1), [])

  useEffect(() => {
    if (!headersMemo || !paramsMemo?.month) {
      setLoading(false)
      return
    }

    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const sp = new URLSearchParams()
        sp.set('month', paramsMemo.month)
        if (paramsMemo.page) sp.set('page', String(paramsMemo.page))
        sp.set('limit', '20')

        const endpoint = `/api/reports/monthly?${sp.toString()}`
        const res = await fetcher(endpoint, { headers: headersMemo })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error?.message ?? `レポート一覧の取得に失敗しました (${res.status})`)
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
  }, [fetcher, headersMemo, paramsMemo, revision])

  return { data, error, loading, refetch }
}
