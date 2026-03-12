/** @file
 * 機能：月間利用状況（残り質問数）を表示するコンパクトなバッジ。
 * 入力：token（認証トークン）
 * 出力：「残り 87/100」形式のバッジ UI。残り 20% 以下で黄色、5% 以下で赤色。
 * 依存：GET /api/usage
 * セキュリティ：認証トークンを Authorization ヘッダで送信。
 */
'use client'

import { useCallback, useEffect, useState } from 'react'

type UsageData = {
  used: number
  limit: number
  remaining: number
}

type UsageBadgeProps = {
  token: string
  /** 値が変わるたびに /api/usage を再取得する。チャット送信完了後の更新用。 */
  refreshKey?: number
}

export function UsageBadge({ token, refreshKey = 0 }: UsageBadgeProps) {
  const [usage, setUsage] = useState<UsageData | null>(null)

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/usage', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const json = (await res.json()) as { data: UsageData }
      setUsage(json.data)
    } catch {
      // フェッチ失敗時はバッジを非表示にする
    }
  }, [token])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage, refreshKey])

  if (!usage) return null

  const { remaining, limit } = usage
  const ratio = remaining / limit

  let colorClass: string
  if (ratio <= 0.05) {
    colorClass = 'bg-red-100 text-red-700'
  } else if (ratio <= 0.2) {
    colorClass = 'bg-yellow-100 text-yellow-700'
  } else {
    colorClass = 'bg-gray-100 text-gray-600'
  }

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colorClass}`}
      title={`今月の残り質問数: ${remaining}/${limit}`}
    >
      残り {remaining}/{limit}
    </span>
  )
}
