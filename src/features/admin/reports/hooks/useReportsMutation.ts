/** @file
 * POST /api/reports/monthly の生成/再生成 + CSV ダウンロードミューテーションフック。
 * 入力: headers（認証トークン）、fetcher（テスト用差し替え可）。
 * 出力: generateReports, regenerateReport, downloadCsv 関数。
 * 依存: なし（純粋な fetch ラッパー）。
 * セキュリティ: Bearer トークンを headers 経由で送信。
 */

type Fetcher = typeof fetch

type MutationOptions = {
  fetcher?: Fetcher
  headers?: HeadersInit
}

export function useReportsMutation(options: MutationOptions = {}) {
  const { fetcher = fetch, headers } = options

  async function generateReports(month: string, dryRun: boolean) {
    const res = await fetcher('/api/reports/monthly', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ month, dryRun }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json?.error?.message ?? `レポート生成に失敗しました (${res.status})`)
    }
    return json.data
  }

  async function regenerateReport(month: string, userId: string) {
    const res = await fetcher('/api/reports/monthly', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ month, userId }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json?.error?.message ?? `レポート再生成に失敗しました (${res.status})`)
    }
    return json.data
  }

  async function downloadCsv(month: string) {
    const res = await fetcher(`/api/reports/monthly/csv?month=${encodeURIComponent(month)}`, {
      headers: { ...headers },
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json?.error?.message ?? `CSV ダウンロードに失敗しました (${res.status})`)
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `marubo_ai_report_${month}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return { generateReports, regenerateReport, downloadCsv }
}
