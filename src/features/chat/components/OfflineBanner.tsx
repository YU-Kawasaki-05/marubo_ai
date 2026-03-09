/** @file
 * オフライン時に表示される警告バナー。
 * 入力: isOnline（ネットワーク接続状態）。
 * 出力: 黄色の警告バナー UI（オフライン時のみ表示）。
 * 依存: React。
 * セキュリティ: なし（表示のみ）。
 */

type OfflineBannerProps = {
  isOnline: boolean
}

export function OfflineBanner({ isOnline }: OfflineBannerProps) {
  if (isOnline) return null

  return (
    <div className="flex items-center gap-2 bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>インターネット接続がありません。接続を確認してください。</span>
    </div>
  )
}
