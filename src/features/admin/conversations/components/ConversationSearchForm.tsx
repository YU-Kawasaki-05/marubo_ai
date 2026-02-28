/** @file
 * 会話検索フィルタフォーム。
 * 入力: onSearch コールバック、disabled フラグ。
 * 出力: email/from/to/keyword を含む検索パラメータ。
 * 依存: React hooks。
 * セキュリティ: クライアント側のみ、入力値はそのまま API に渡す。
 */

'use client'

import { useState } from 'react'

import type { ConversationsQueryParams } from '../hooks/useConversationsQuery'

type ConversationSearchFormProps = {
  onSearch: (params: ConversationsQueryParams) => void
  disabled?: boolean
}

export function ConversationSearchForm({ onSearch, disabled }: ConversationSearchFormProps) {
  const [email, setEmail] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [keyword, setKeyword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch({
      email: email.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
      keyword: keyword.trim() || undefined,
      page: 1,
    })
  }

  const handleReset = () => {
    setEmail('')
    setFrom('')
    setTo('')
    setKeyword('')
    onSearch({ page: 1 })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="search-email" className="block text-sm font-medium text-slate-700">
            生徒メール
          </label>
          <input
            id="search-email"
            type="text"
            placeholder="例: taro@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={disabled}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="search-keyword" className="block text-sm font-medium text-slate-700">
            キーワード（タイトル）
          </label>
          <input
            id="search-keyword"
            type="text"
            placeholder="例: 方程式"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={disabled}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="search-from" className="block text-sm font-medium text-slate-700">
            期間（開始日）
          </label>
          <input
            id="search-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            disabled={disabled}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="search-to" className="block text-sm font-medium text-slate-700">
            期間（終了日）
          </label>
          <input
            id="search-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={disabled}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          disabled={disabled}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          検索
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={disabled}
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          リセット
        </button>
      </div>
    </form>
  )
}
