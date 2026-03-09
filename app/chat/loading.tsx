/** @file
 * チャット画面専用ローディング UI。
 * 機能: チャットページ遷移時にスケルトン UI を表示。
 * 入力: なし。
 * 出力: ヘッダー + メッセージバブルのスケルトン UI。
 * 依存: Tailwind CSS。
 */

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50">
      {/* ヘッダースケルトン */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-5 w-12 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-5 w-16 animate-pulse rounded bg-gray-200" />
          <div className="h-5 w-16 animate-pulse rounded bg-gray-200" />
        </div>
      </div>

      {/* メッセージエリアスケルトン */}
      <div className="flex-1 overflow-hidden p-4 space-y-4">
        {/* ユーザーメッセージ風 */}
        <div className="flex justify-end">
          <div className="h-10 w-48 animate-pulse rounded-lg bg-gray-200" />
        </div>
        {/* AI 応答風 */}
        <div className="flex justify-start">
          <div className="h-20 w-64 animate-pulse rounded-lg bg-gray-200" />
        </div>
        {/* ユーザーメッセージ風 */}
        <div className="flex justify-end">
          <div className="h-10 w-56 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>

      {/* 入力エリアスケルトン */}
      <div className="border-t bg-white p-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <div className="h-12 flex-1 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-12 w-16 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>
    </div>
  )
}
