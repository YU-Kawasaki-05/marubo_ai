/** @file
 * ログインページ
 * 機能: メールアドレス・パスワードでのログイン / 新規登録 / パスワードリセット導線
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
import { useState } from 'react'

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
        // トークン取得失敗時はフォールバック
        router.push('/chat')
        return
      }

      // sync-user でロール・許可ステータスを取得してルーティング分岐
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

        // エラーレスポンスを解析
        const errorData = await res.json()
        const errorCode = errorData?.error?.code as string | undefined

        if (errorCode === 'ALLOWLIST_PENDING') {
          setMessageType('warning')
          setMessage('管理者の承認をお待ちください。承認後にログインできます。')
          // pending の場合はサインアウトしてセッションをクリア
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
        // sync-user 呼び出し失敗時はフォールバック
        router.push('/chat')
      }
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
              {isLoading ? '処理中...' : 'ログイン'}
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
