'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { CsvImportForm } from '../../../src/features/admin/allowlist/components/CsvImportForm'
import { useAllowlistMutations } from '../../../src/features/admin/allowlist/hooks/useAllowlistMutations'
import { useAllowlistQuery } from '../../../src/features/admin/allowlist/hooks/useAllowlistQuery'
import { LogoutButton } from '../../../src/shared/components/LogoutButton'
import { getSupabaseBrowserClient } from '../../../src/shared/lib/supabaseClient'

type AllowedEmailStatus = 'active' | 'pending' | 'revoked'

export default function AllowlistPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AllowedEmailStatus | 'all'>('all')

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

  const { data, loading, error } = useAllowlistQuery({
    search: search || undefined,
    status: statusFilter,
    headers, // 定義済みの headers を渡す
  })

  const { updateAllowedEmail, importCsv } = useAllowlistMutations({ headers })

  // セッション確認中またはデータ読み込み中の表示
  if (isCheckingSession || (loading && !error)) {
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
          <Link href="/" className="text-sm text-indigo-600 hover:underline">
            戻る
          </Link>
        </div>
      </header>

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

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-700">登録件数</p>
            <p className="text-2xl font-bold text-slate-900">{data?.length ?? 0}</p>
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {data?.map((item) => (
            <div key={item.email} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{item.email}</p>
                <p className="text-xs text-slate-600">label: {item.label ?? '-'}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusDropdown
                  current={item.status as AllowedEmailStatus}
                  onChange={async (nextStatus) => {
                    try {
                      await updateAllowedEmail(item.email, { status: nextStatus })
                      // 更新成功したらリロードで反映（初心者向けの実装）
                      window.location.reload()
                    } catch (err) {
                      const message = err instanceof Error ? err.message : '予期せぬエラーが発生しました'
                      alert(`更新エラー: ${message}`)
                    }
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
          window.location.reload()
        }}
      />
    </main>
  )
}

type StatusDropdownProps = {
  current: AllowedEmailStatus
  onChange: (status: AllowedEmailStatus) => Promise<void>
}

function StatusDropdown({ current, onChange }: StatusDropdownProps) {
  const [updating, setUpdating] = useState(false)

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
        disabled={updating}
        onChange={async (e) => {
          const next = e.target.value as AllowedEmailStatus
          if (next === current) return
          
          if (!confirm(`${current} から ${next} に変更しますか？`)) {
            // 値を戻す
            e.target.value = current 
            return
          }

          setUpdating(true)
          try {
            await onChange(next)
          } finally {
            setUpdating(false)
          }
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
