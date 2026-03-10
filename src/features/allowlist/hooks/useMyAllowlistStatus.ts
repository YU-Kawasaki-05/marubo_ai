/** @file
 * ログイン中ユーザーの許可ステータスを取得するフック。
 * 機能：Supabase セッションから email を取得し allowed_email テーブルを参照。
 * 入力：なし（内部で Supabase Browser Client を使用）。
 * 出力：{ status: AllowedEmailStatus | 'not-found', loading: boolean }。
 * 依存：Supabase Browser Client。
 * セキュリティ：RLS により自分の行のみ取得可能。
 */

import { useEffect, useState } from 'react'

import { getSupabaseBrowserClient } from '../../../shared/lib/supabaseClient'
import type { AllowedEmailStatus } from '../../../shared/types/database'

type MyStatus = {
  status: AllowedEmailStatus | 'not-found'
  loading: boolean
}

/**
 * ログイン中のユーザー自身の許可ステータスを取得するフック
 *
 * @returns {MyStatus} status: 'active' | 'pending' | 'revoked' | 'not-found'
 */
export function useMyAllowlistStatus(): MyStatus {
  const [status, setStatus] = useState<AllowedEmailStatus | 'not-found'>('not-found') // デフォルトは 'not-found'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const fetchStatus = async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        
        // 1. まず現在のログインユーザー情報を取得
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.email) {
          // ログインしていない場合は処理終了 (status は 'not-found' のまま)
          if (mounted) setLoading(false)
          return
        }

        // 2. 自分のメールアドレスで allowed_email テーブルを検索
        // RLS (Row Level Security) が効いているため、自分の行しか取得できません。
        // 結果が0件の場合は error ではなく data が null または空配列になります。
        const { data, error } = await supabase
          .from('allowed_email')
          .select('status')
          .eq('email', session.user.email)
          .maybeSingle() // 0件または1件取得

        if (error) {
          console.error('Failed to fetch allowlist status:', error)
          // エラーの場合も安全側に倒して 'not-found' 扱いとする（あるいは別途エラー状態を作る）
        }

        if (mounted) {
          if (data) {
            setStatus(data.status as AllowedEmailStatus)
          } else {
            setStatus('not-found')
          }
        }
      } catch (err) {
        console.error('Unexpected error in useMyAllowlistStatus:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchStatus()

    return () => {
      mounted = false
    }
  }, [])

  return { status, loading }
}
