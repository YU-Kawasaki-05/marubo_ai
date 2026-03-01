/** @file
 * GET /api/reports/monthly のデータ取得フック（生徒用）。
 * 入力: headers（認証トークン）、month（対象月 YYYY-MM）。
 * 出力: { data: { report } | null, error, loading }。
 * 依存: React hooks。
 * セキュリティ: Bearer トークンを headers 経由で送信。API 側で自分のレポートのみ返却。
 */

import { useEffect, useMemo, useState } from 'react'

export type StudentReport = {
  id: string
  month: string
  status: string
  content: string | null
  stats: {
    questions: number
    conversations: number
    activeDays: number
    mostActiveDay: string | null
  } | null
  generatedAt: string | null
}

type StudentReportData = {
  report: StudentReport | null
}

type Fetcher = typeof fetch

type UseStudentReportOptions = {
  fetcher?: Fetcher
  headers?: HeadersInit
  month?: string
}

export function useStudentReport(options: UseStudentReportOptions = {}) {
  const { fetcher = fetch, headers, month } = options
  const [data, setData] = useState<StudentReportData | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const headersKey = headers ? JSON.stringify(headers) : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const headersMemo = useMemo(() => headers, [headersKey])

  useEffect(() => {
    if (!headersMemo || !month) {
      setLoading(false)
      return
    }

    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const url = `/api/reports/monthly?month=${encodeURIComponent(month)}`
        const res = await fetcher(url, { headers: headersMemo })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error?.message ?? `レポートの取得に失敗しました (${res.status})`)
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
  }, [fetcher, headersMemo, month])

  return { data, error, loading }
}
