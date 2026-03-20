/** @file
 * ログインページ
 * 機能: Google OAuth / メールアドレス・パスワードでのログイン / 新規登録 / パスワードリセット導線
 * ログイン成功後、/api/sync-user の role と allowedEmailStatus に応じてルーティング先を決定
 *   - staff → /admin
 *   - student (active) → /chat
 *   - pending → 待機メッセージ表示
 *   - revoked / not-found → エラーメッセージ表示
 *   - sync-user 失敗 → /chat にフォールバック
 * 依存: supabaseClient (browser), /api/sync-user
 */
'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getSupabaseBrowserClient } from '../../src/shared/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'info' | 'error' | 'warning'>('info')
  const [showResetForm, setShowResetForm] = useState(false)
  const [resetEmail, setResetEmail] = useState('')

  const supabase = getSupabaseBrowserClient()

  // OAuth コールバック後の sync-user 処理を共通化
  const syncAndRedirect = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/sync-user', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (res.ok) {
        const body = await res.json()
        if (body.data?.role === 'staff') {
          router.push('/admin')
        } else {
          router.push('/chat')
        }
        return
      }

      const errorData = await res.json()
      const errorCode = errorData?.error?.code as string | undefined

      if (errorCode === 'ALLOWLIST_PENDING') {
        setMessageType('warning')
        setMessage('管理者の承認をお待ちください。承認後にログインできます。')
        await supabase.auth.signOut()
        return
      }

      if (errorCode === 'ALLOWLIST_REVOKED') {
        setMessageType('error')
        setMessage('アカウントが停止されています。管理者にお問い合わせください。')
        await supabase.auth.signOut()
        return
      }

      if (errorCode === 'ALLOWLIST_NOT_FOUND') {
        setMessageType('error')
        setMessage('許可されていないメールアドレスです。管理者にお問い合わせください。')
        await supabase.auth.signOut()
        return
      }

      // その他のエラーはフォールバック
      router.push('/chat')
    } catch {
      router.push('/chat')
    }
  }, [router, supabase.auth])

  // OAuth コールバック検知: Google 認証後にリダイレクトされてきた場合
  const oauthHandled = useRef(false)
  useEffect(() => {
    if (oauthHandled.current) return
    const supabaseClient = getSupabaseBrowserClient()
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token && !oauthHandled.current) {
        oauthHandled.current = true
        setIsLoading(true)
        syncAndRedirect(session.access_token).finally(() => setIsLoading(false))
      }
    })
  }, [syncAndRedirect])

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    })
    if (error) {
      setMessageType('error')
      setMessage('Google ログインに失敗しました。')
      setIsLoading(false)
    }
    // 成功時はページ遷移するため setIsLoading(false) は不要
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        throw error
      }

      // セッションからトークンを取得
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        router.push('/chat')
        return
      }

      await syncAndRedirect(token)
    } catch (err) {
      const error = err as Error
      setMessageType('error')
      if (error.message.includes('Invalid login credentials')) {
        setMessage('メールアドレスまたはパスワードが間違っています。')
      } else {
        setMessage(`ログインエラー: ${error.message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async () => {
    setIsLoading(true)
    setMessage(null)
    const cleanEmail = email.trim()
    try {
      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      })
      if (error) {
        throw error
      }
      setMessage('登録確認メールを送信しました。（開発環境等でオートコンファームの場合はそのままログインボタンを押してください）')
    } catch (err) {
      console.error(err)
      const error = err as Error
      if (error.message.includes('invalid')) {
        setMessage(`エラー: メールアドレスの形式が無効か、許可されていないドメインです。別のメールアドレス（例: student1@example.com や Gmailなど）を試してください。\n詳細: ${error.message}`)
      } else if (error.message.includes('User already registered')) {
        setMessage('このメールアドレスは既に登録されています。ログインしてください。')
      } else {
        setMessage(`エラーが発生しました: ${error.message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async () => {
    const trimmed = resetEmail.trim()
    if (!trimmed) return
    setIsLoading(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setMessageType('info')
      setMessage('パスワードリセットメールを送信しました。メールのリンクからパスワードを再設定してください。')
    } catch (err) {
      const error = err as Error
      setMessageType('error')
      setMessage(`エラー: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-slate-800">ログイン</h1>

        {message && (
          <div
            className={`mb-4 rounded p-3 text-sm break-words whitespace-pre-wrap ${
              messageType === 'error'
                ? 'bg-red-50 text-red-700'
                : messageType === 'warning'
                  ? 'bg-yellow-50 text-yellow-700'
                  : 'bg-blue-50 text-blue-700'
            }`}
          >
            {message}
          </div>
        )}

        {/* Google OAuth ログインボタン */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="mb-4 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google でログイン
        </button>

        {/* 区切り線 */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-4 text-slate-400">または</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">メールアドレス</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              placeholder="例: student1@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">パスワード</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded bg-indigo-600 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? '処理中...' : 'メールでログイン'}
            </button>
          </div>
        </form>

        {showResetForm ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-center text-sm font-medium text-slate-700">パスワードリセット</p>
            <div className="space-y-3">
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="登録済みメールアドレス"
              />
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={isLoading || !resetEmail.trim()}
                className="w-full rounded bg-slate-600 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {isLoading ? '送信中...' : 'リセットメール送信'}
              </button>
              <button
                type="button"
                onClick={() => { setShowResetForm(false); setMessage(null) }}
                className="w-full text-center text-xs text-slate-500 hover:underline"
              >
                ログインに戻る
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => { setShowResetForm(true); setMessage(null) }}
              className="text-xs text-slate-500 hover:underline"
            >
              パスワードを忘れた方
            </button>
          </div>
        )}

        <div className="mt-4 border-t border-slate-100 pt-4 text-center">
          <p className="mb-2 text-xs text-slate-500">アカウントをお持ちでない場合</p>
          <button
            type="button"
            onClick={handleSignUp}
            disabled={isLoading || !email || !password}
            className="text-sm text-indigo-600 hover:underline disabled:opacity-50"
          >
            新規登録 (Sign Up)
          </button>
        </div>
      </div>
    </main>
  )
}
