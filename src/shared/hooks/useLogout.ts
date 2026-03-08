/** @file
 * ログアウト処理を提供するカスタムフック。
 * 機能: supabase.auth.signOut() を呼び出し、/login にリダイレクト。
 * 出力: { logout, isLoggingOut } — ログアウト関数と処理中フラグ。
 * 依存: supabaseClient (browser), next/navigation。
 */

'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

import { getSupabaseBrowserClient } from '../lib/supabaseClient'

export function useLogout() {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const logout = useCallback(async () => {
    setIsLoggingOut(true)
    try {
      const supabase = getSupabaseBrowserClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch {
      // サインアウト失敗時も /login に遷移（セッション不整合を防ぐ）
      router.push('/login')
    }
  }, [router])

  return { logout, isLoggingOut }
}
