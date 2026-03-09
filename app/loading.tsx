/** @file
 * グローバルローディング UI。
 * 機能: ページ遷移時に中央スピナーを表示する Next.js loading convention。
 * 入力: なし。
 * 出力: スピナー + テキストの UI。
 * 依存: Tailwind CSS。
 */

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    </div>
  )
}
