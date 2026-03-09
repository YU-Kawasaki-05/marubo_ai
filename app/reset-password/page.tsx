/** @file
 * パスワード再設定ページ。
 * 入力: Supabase リセットリンクのトークン（URL フラグメント経由で自動処理）。
 * 出力: パスワード再設定フォーム UI。
 * 依存: Supabase Browser Client (`onAuthStateChange`, `updateUser`)。
 * セキュリティ: PASSWORD_RECOVERY イベント検知後のみフォームを有効化。
 */

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getSupabaseBrowserClient } from '../../src/shared/lib/supabaseClient'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info')
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true)
        setIsCheckingSession(false)
      }
    })

    // セッション確認のタイムアウト（リカバリーイベントが来ない場合）
    const timeout = setTimeout(() => {
      setIsCheckingSession(false)
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [supabase.auth])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setMessageType('error')
      setMessage('パスワードが一致しません。')
      return
    }

    if (password.length < 6) {
      setMessageType('error')
      setMessage('パスワードは6文字以上で入力してください。')
      return
    }

    setIsLoading(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setMessageType('success')
      setMessage('パスワードを更新しました。ログイン画面に移動します...')
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err) {
      const error = err as Error
      setMessageType('error')
      setMessage(`エラー: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-md">
          <h1 className="mb-4 text-center text-2xl font-bold text-slate-800">パスワード再設定</h1>
          <p className="text-center text-sm text-slate-600">セッションを確認中...</p>
        </div>
      </main>
    )
  }

  if (!isRecoveryMode) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-md">
          <h1 className="mb-4 text-center text-2xl font-bold text-slate-800">パスワード再設定</h1>
          <p className="mb-4 text-center text-sm text-red-600">
            リセットリンクが無効か、有効期限が切れています。
          </p>
          <Link
            href="/login"
            className="block text-center text-sm text-indigo-600 hover:underline"
          >
            ログイン画面へ戻る
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-slate-800">パスワード再設定</h1>

        {message && (
          <div
            className={`mb-4 rounded p-3 text-sm ${
              messageType === 'error'
                ? 'bg-red-50 text-red-700'
                : messageType === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-blue-50 text-blue-700'
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">新しいパスワード</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              placeholder="6文字以上"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">パスワード（確認）</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded bg-indigo-600 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? '更新中...' : 'パスワードを更新'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <Link href="/login" className="text-xs text-slate-500 hover:underline">
            ログイン画面へ戻る
          </Link>
        </div>
      </div>
    </main>
  )
}
