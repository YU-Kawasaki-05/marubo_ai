/** @file
 * ネットワーク接続状態の監視フック。
 * 入力: なし。
 * 出力: { isOnline: boolean }。
 * 依存: React hooks, navigator.onLine, window online/offline イベント。
 * セキュリティ: なし（読み取り専用）。
 */

import { useEffect, useState } from 'react'

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline }
}
