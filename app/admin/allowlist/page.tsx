/** @file
 * `/admin/allowlist` スタッフ用許可メール管理ページ。
 * 入力: Supabase セッション（Bearer トークン）。
 * 出力: 検索/フィルタ付き許可メール一覧 + ステータス変更 + CSV 一括登録。
 * 依存: useAllowlistQuery, useAllowlistMutations, CsvImportForm, ConfirmDialog。
 * セキュリティ: requireStaff() で API 側で認可チェック。
 */

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { CsvImportForm } from '../../../src/features/admin/allowlist/components/CsvImportForm'
import { useAllowlistMutations } from '../../../src/features/admin/allowlist/hooks/useAllowlistMutations'
import { useAllowlistQuery } from '../../../src/features/admin/allowlist/hooks/useAllowlistQuery'
import { ConfirmDialog } from '../../../src/shared/components/ConfirmDialog'
import { LogoutButton } from '../../../src/shared/components/LogoutButton'
import { getSupabaseBrowserClient } from '../../../src/shared/lib/supabaseClient'

type DialogState = {
  open: boolean
  title: string
  message: string
  variant?: 'default' | 'destructive'
  confirmLabel?: string
  cancelLabel?: string | null
  onConfirm: () => void
}

type AllowedEmailStatus = 'active' | 'pending' | 'revoked'

type FlashMessage = {
  type: 'success' | 'error'
  text: string
}

export default function AllowlistPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AllowedEmailStatus | 'all'>('all')
  const [flash, setFlash] = useState<FlashMessage | null>(null)
  const [dialog, setDialog] = useState<DialogState>({
    open: false, title: '', message: '', onConfirm: () => {},
  })

  const closeDialog = () => setDialog((prev) => ({ ...prev, open: false }))

  // 認証トークンの管理
  const [token, setToken] = useState<string | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    // マウント時に認証セッションを取得
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null)
      setIsCheckingSession(false)
    })
  }, [])

  // トークンがある場合のみ Authorization ヘッダをセット
  const headers = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : undefined
  }, [token])

  const { data, loading, fetching, error, refetch } = useAllowlistQuery({
    search: search || undefined,
    status: statusFilter,
    headers, // 定義済みの headers を渡す
  })

  const { createAllowedEmail, updateAllowedEmail, importCsv } = useAllowlistMutations({ headers })

  // セッション確認中またはデータ読み込み中の表示
  if (isCheckingSession || loading) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-bold">許可メール一覧</h1>
        <p className="mt-4 text-slate-600">読み込み中…</p>
      </main>
    )
  }

  // 認証エラー（ログインしていない場合など）
  if (!token) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-bold">許可メール一覧</h1>
        <p className="mt-4 text-red-600">ログインが必要です。</p>
        <Link href="/login" className="text-indigo-600 underline">
          ログイン画面へ
        </Link>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-bold">許可メール一覧</h1>
        <p className="mt-4 text-red-600">エラー: {error.message}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-slate-500">Allowlist</p>
          <h1 className="text-2xl font-bold text-slate-900">許可メール一覧</h1>
          <p className="text-sm text-slate-600">スタッフ専用の許可メール管理です。</p>
        </div>
        <div className="flex items-center gap-4">
          <LogoutButton />
          <Link href="/admin" className="text-sm text-indigo-600 hover:underline">
            戻る
          </Link>
        </div>
      </header>

      {flash && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium ${
            flash.type === 'success'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <span>{flash.text}</span>
          <button
            type="button"
            onClick={() => setFlash(null)}
            className="ml-4 shrink-0 text-lg leading-none opacity-60 hover:opacity-100"
            aria-label="閉じる"
          >
            &times;
          </button>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="search"
            placeholder="メールやラベルで検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm md:w-1/2"
            aria-label="検索"
          />
          <select
            aria-label="ステータス絞り込み"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm md:w-40"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AllowedEmailStatus | 'all')}
          >
            <option value="all">すべて</option>
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="revoked">revoked</option>
          </select>
        </div>
      </section>

      <AddStudentForm
        onAdd={async (input) => {
          await createAllowedEmail(input)
          setFlash({ type: 'success', text: `${input.email} を登録しました` })
          refetch()
        }}
        onError={(msg) => setFlash({ type: 'error', text: msg })}
      />

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-700">登録件数</p>
            <p className="text-2xl font-bold text-slate-900">{data?.length ?? 0}</p>
          </div>
          {fetching && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
              更新中...
            </div>
          )}
        </div>
        <div className="divide-y divide-slate-200">
          {data?.map((item) => (
            <div key={item.email} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.email}</p>
                  {item.initial_role === 'staff' && (
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                      スタッフ
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600">label: {item.label ?? '-'}</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  aria-label="初期ロール変更"
                  value={item.initial_role || 'student'}
                  onChange={async (e) => {
                    const nextRole = e.target.value as 'student' | 'staff'
                    try {
                      await updateAllowedEmail(item.email, { initial_role: nextRole })
                      setFlash({ type: 'success', text: `${item.email} の初期ロールを${nextRole === 'staff' ? 'スタッフ' : '生徒'}に変更しました` })
                      refetch()
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : '予期せぬエラーが発生しました'
                      setFlash({ type: 'error', text: msg })
                    }
                  }}
                  className={`appearance-none rounded border px-2 py-1 pr-7 text-xs font-medium ${
                    item.initial_role === 'staff'
                      ? 'bg-purple-50 border-purple-200 text-purple-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                  title="初期ロール（初回ログイン時に適用）"
                >
                  <option value="student">生徒</option>
                  <option value="staff">スタッフ</option>
                </select>
                <StatusDropdown
                  current={item.status as AllowedEmailStatus}
                  onRequestChange={(next) => {
                    setDialog({
                      open: true,
                      title: 'ステータス変更の確認',
                      message: `${item.email} のステータスを ${item.status} から ${next} に変更しますか？`,
                      confirmLabel: '変更する',
                      onConfirm: async () => {
                        closeDialog()
                        try {
                          await updateAllowedEmail(item.email, { status: next })
                          setFlash({ type: 'success', text: `${item.email} のステータスを ${next} に変更しました` })
                          refetch()
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : '予期せぬエラーが発生しました'
                          setFlash({ type: 'error', text: msg })
                        }
                      },
                    })
                  }}
                />
              </div>
            </div>
          ))}
          {data?.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              データが見つかりませんでした。
            </div>
          )}
        </div>
      </section>

      <CsvImportForm
        onImport={async (csv, mode) => {
          await importCsv(csv, mode)
          setFlash({ type: 'success', text: 'CSV 一括登録が完了しました' })
          refetch()
        }}
      />

      <ConfirmDialog
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.confirmLabel}
        cancelLabel={dialog.cancelLabel}
        variant={dialog.variant}
        onConfirm={dialog.onConfirm}
        onCancel={closeDialog}
      />
    </main>
  )
}

type StatusDropdownProps = {
  current: AllowedEmailStatus
  onRequestChange: (status: AllowedEmailStatus) => void
}

type AddStudentFormProps = {
  onAdd: (input: { email: string; status: 'active'; label: string | null; initial_role: 'student' | 'staff' }) => Promise<void>
  onError: (message: string) => void
}

function AddStudentForm({ onAdd, onError }: AddStudentFormProps) {
  const [email, setEmail] = useState('')
  const [label, setLabel] = useState('')
  const [initialRole, setInitialRole] = useState<'student' | 'staff'>('student')
  const [submitting, setSubmitting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    // 簡易メール形式チェック
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      onError('メールアドレスの形式が正しくありません。')
      return
    }

    setSubmitting(true)
    try {
      await onAdd({
        email: trimmed,
        status: 'active',
        label: label.trim() || null,
        initial_role: initialRole,
      })
      setEmail('')
      setLabel('')
      setInitialRole('student')
      setIsOpen(false)
    } catch (err) {
      onError(err instanceof Error ? err.message : '登録に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }, [email, label, initialRole, onAdd, onError])

  if (!isOpen) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          ユーザーを個別登録
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-700">ユーザーを個別登録</h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-sm text-slate-400 hover:text-slate-600"
          aria-label="閉じる"
        >
          &times;
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label htmlFor="add-email" className="block text-xs font-medium text-slate-600 mb-1">
            メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            id="add-email"
            type="email"
            required
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            disabled={submitting}
          />
        </div>
        <div className="md:w-48">
          <label htmlFor="add-label" className="block text-xs font-medium text-slate-600 mb-1">
            ラベル（任意）
          </label>
          <input
            id="add-label"
            type="text"
            placeholder="2025, 高1 など"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            disabled={submitting}
          />
        </div>
        <div className="md:w-32">
          <label htmlFor="add-role" className="block text-xs font-medium text-slate-600 mb-1">
            ロール
          </label>
          <select
            id="add-role"
            value={initialRole}
            onChange={(e) => setInitialRole(e.target.value as 'student' | 'staff')}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
            disabled={submitting}
          >
            <option value="student">生徒</option>
            <option value="staff">スタッフ</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={submitting || !email.trim()}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? '登録中...' : '登録'}
        </button>
      </form>
      <p className="mt-2 text-xs text-slate-500">
        登録されたユーザーは active ステータスで追加されます。
      </p>
      <p className="mt-1 text-xs text-slate-400">
        ※ ロールは初回ログイン時のみ適用されます。ログイン後の変更は権限管理ページで行えます。
      </p>
    </section>
  )
}

function StatusDropdown({ current, onRequestChange }: StatusDropdownProps) {
  return (
    <div className="relative">
      <select
        aria-label="ステータス変更"
        className={`appearance-none rounded border px-3 py-1 pr-8 text-sm font-medium disabled:opacity-50 ${
          current === 'active'
            ? 'bg-green-50 border-green-200 text-green-700'
            : current === 'pending'
            ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}
        value={current}
        onChange={(e) => {
          const next = e.target.value as AllowedEmailStatus
          if (next === current) return
          // 値を戻す（確認ダイアログで承認後にリロードされる）
          e.target.value = current
          onRequestChange(next)
        }}
      >
        <option value="active">active</option>
        <option value="pending">pending</option>
        <option value="revoked">revoked</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" />
        </svg>
      </div>
    </div>
  )
}
