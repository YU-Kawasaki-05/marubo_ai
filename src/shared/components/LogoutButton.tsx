/** @file
 * ログアウトボタンコンポーネント。
 * 機能: クリックで supabase.auth.signOut() → /login リダイレクト。
 * 依存: useLogout フック。
 */

'use client'

import { useLogout } from '../hooks/useLogout'

export function LogoutButton() {
  const { logout, isLoggingOut } = useLogout()

  return (
    <button
      type="button"
      onClick={logout}
      disabled={isLoggingOut}
      className="text-sm font-medium text-gray-500 hover:text-gray-900 disabled:opacity-50"
    >
      {isLoggingOut ? 'ログアウト中...' : 'ログアウト'}
    </button>
  )
}
