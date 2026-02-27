/** @file
 * GET /api/admin/grant のデータ取得フック。
 * 入力: headers（認証トークン）、fetcher（テスト用差し替え可）。
 * 出力: { data: { staffUsers, auditLog } | null, error, loading }。
 * 依存: React hooks。
 * セキュリティ: Bearer トークンを headers 経由で送信。
 */

import { useEffect, useMemo, useState } from 'react'

export type StaffUser = {
  email: string
  displayName: string | null
  role: string
  grantedAt: string
}

export type AuditLogEntry = {
  id: string
  operatorEmail: string
  targetEmail: string
  action: 'grant' | 'revoke'
  createdAt: string
}

export type GrantData = {
  staffUsers: StaffUser[]
  auditLog: AuditLogEntry[]
}

type Fetcher = typeof fetch

type UseGrantQueryOptions = {
  fetcher?: Fetcher
  headers?: HeadersInit
}

export function useGrantQuery(options: UseGrantQueryOptions = {}) {
  const { fetcher = fetch, headers } = options
  const [data, setData] = useState<GrantData | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const headersKey = headers ? JSON.stringify(headers) : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const headersMemo = useMemo(() => headers, [headersKey])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetcher('/api/admin/grant', { headers: headersMemo })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error?.message ?? `Failed to load grant info (${res.status})`)
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
  }, [fetcher, headersMemo])

  return { data, error, loading }
}
