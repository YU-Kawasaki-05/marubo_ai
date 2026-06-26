/** @file
 * ユーザー自身の許可ステータスに応じて警告バナーを表示するコンポーネント。
 * 機能：pending/revoked/not-found 時にバナー表示、active・未ログインでは非表示。
 * 入力：なし（内部で Supabase セッション + allowed_email を参照）。
 * 出力：条件付き警告バナー UI。
 * 依存：useMyAllowlistStatus フック、Supabase Browser Client。
 * セキュリティ：クライアント側のみ。セッション有無で不要なクエリを抑制。
 */

'use client'

import { useEffect, useState } from 'react'

import { useMyAllowlistStatus } from '../hooks/useMyAllowlistStatus'

import { getSupabaseBrowserClient } from '@shared/lib/supabaseClient'

/**
 * 外側コンポーネント: セッション有無を先にチェックし、
 * ログイン中の場合のみ内側（フック使用）をマウントする。
 * これにより未ログイン時の getSession() → DB クエリを完全に抑制する。
 */
export function AccountStatusBanner() {
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    const supabase = getSupabaseBrowserClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setHasSession(!!session)
    })

    // セッション変化を監視し、ログアウト時にバナーを非表示にする
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setHasSession(!!session)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // セッション確認中、または未ログイン時は何も表示しない
  if (!hasSession) return null

  return <AccountStatusBannerInner />
}

/**
 * 内側コンポーネント: ログイン済みの場合のみマウントされる。
 * useMyAllowlistStatus フックを使用してステータスを取得・表示する。
 */
function AccountStatusBannerInner() {
  const { status, loading } = useMyAllowlistStatus()

  // 読み込み中、または正常(active)の場合は何も表示しない
  if (loading || status === 'active') {
    return null
  }

  // ステータスに応じたメッセージとスタイルの定義
  const config = {
    pending: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      title: '利用開始の準備中です',
      message: '管理者による承認をお待ちください。承認されると全ての機能が利用可能になります。',
    },
    revoked: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      title: 'アカウントは現在利用できません',
      message: 'お客様のアカウントは管理者により利用が停止されています。',
    },
    'not-found': {
      bgColor: 'bg-slate-50',
      borderColor: 'border-slate-200',
      textColor: 'text-slate-800',
      title: '許可リストに登録されていません',
      message: 'このアプリを利用するには、管理者にメールアドレスを登録してもらう必要があります。',
    },
  }

  // 現在のステータスに対応する設定を取得（万が一不明なステータスの場合は not-found 扱い）
  const current = config[status] || config['not-found']

  return (
    <div className={`border-b ${current.bgColor} ${current.borderColor} px-4 py-3`}>
      <div className="mx-auto flex max-w-7xl items-start gap-3 md:items-center">
        {/* アイコン部分 */}
        <div className="flex-shrink-0 pt-0.5 md:pt-0">
          <StatusIcon status={status} />
        </div>

        {/* テキスト部分 */}
        <div className="flex-1 md:flex md:justify-between md:gap-4">
          <div>
            <p className={`text-sm font-bold ${current.textColor}`}>
              {current.title}
            </p>
            <p className={`mt-0.5 text-sm ${current.textColor} opacity-90`}>
              {current.message}
            </p>
          </div>

          {/* お問い合わせリンク（共通） */}
          {process.env.NEXT_PUBLIC_SUPPORT_EMAIL && (
            <div className="mt-2 text-sm md:mt-0 md:whitespace-nowrap">
              <a
                href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`}
                className={`underline hover:no-underline ${current.textColor}`}
              >
                管理者へ問い合わせる →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'revoked') {
    // バツ印
    return (
      <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (status === 'pending') {
    // 時計アイコン
    return (
      <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  // その他の情報アイコン
  return (
    <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
