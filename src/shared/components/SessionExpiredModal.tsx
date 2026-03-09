/** @file
 * セッション期限切れモーダル。
 * 入力: isOpen（表示フラグ）、onConfirm（ログイン画面遷移コールバック）。
 * 出力: モーダル UI（背景クリックでは閉じない）。
 * 依存: React。
 * セキュリティ: セッション失効時にユーザーへ明示的に通知し、安全に再ログインを促す。
 */

'use client'

type SessionExpiredModalProps = {
  isOpen: boolean
  onConfirm: () => void
}

export function SessionExpiredModal({ isOpen, onConfirm }: SessionExpiredModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-gray-800">
          セッションが切れました
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          セキュリティのため、セッションの有効期限が切れました。再度ログインしてください。
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-4 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          ログイン画面へ
        </button>
      </div>
    </div>
  )
}
