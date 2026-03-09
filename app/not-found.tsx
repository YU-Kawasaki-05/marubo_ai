/** @file
 * カスタム 404 ページ。
 * 機能: 存在しない URL へのアクセス時にフレンドリーなエラーページを表示。
 * 入力: なし。
 * 出力: 404 メッセージ + ホームリンクの UI。
 * 依存: Next.js Link, Tailwind CSS。
 */

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="mx-4 max-w-md text-center">
        <p className="text-6xl font-bold text-gray-300">404</p>
        <h1 className="mt-4 text-xl font-bold text-gray-800">
          ページが見つかりません
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  )
}
