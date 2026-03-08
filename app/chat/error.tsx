/** @file
 * チャット画面専用 Error Boundary。
 * 機能: /chat 配下のレンダリングエラーをキャッチし、チャット用フォールバック UI を表示。
 * 入力: error (Error & { digest?: string }), reset (() => void)。
 * 出力: エラー回復 UI（再試行ボタン + チャット一覧リンク + ホームリンク）。
 * 依存: なし。
 * セキュリティ: 本番ではエラー詳細を非表示。
 */

'use client'

import Link from 'next/link'
import { useEffect } from 'react'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ChatError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // 将来の Sentry 導入ポイント
    console.error('Chat error boundary caught:', error)
  }, [error])

  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-md">
        <h1 className="text-2xl font-bold text-gray-800">
          チャットでエラーが発生しました
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          チャット画面の表示中にエラーが発生しました。再試行するか、ホームに戻ってください。
        </p>

        {isDev && (
          <div className="mt-4 rounded bg-red-50 p-3 text-left text-xs text-red-700">
            <p className="font-semibold">{error.name}: {error.message}</p>
            {error.digest && (
              <p className="mt-1 text-red-500">Digest: {error.digest}</p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded bg-indigo-600 py-2 font-bold text-white hover:bg-indigo-700"
          >
            再試行
          </button>
          <Link
            href="/chat"
            className="text-sm text-indigo-600 hover:underline"
          >
            チャット一覧に戻る
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:underline"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
