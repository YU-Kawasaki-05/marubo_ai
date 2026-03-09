/** @file
 * 汎用確認/通知ダイアログ。
 * 入力: open, title, message, confirmLabel, cancelLabel, variant, loading, onConfirm, onCancel。
 * 出力: モーダル UI。cancelLabel 省略時は OK ボタンのみ（alert 代替）。
 * 依存: React。
 * セキュリティ: なし（UI のみ）。
 */

'use client'

import { useCallback, useEffect } from 'react'

type ConfirmDialogVariant = 'default' | 'destructive'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string | null
  variant?: ConfirmDialogVariant
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel()
      }
    },
    [onCancel, loading],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  if (!open) return null

  const confirmButtonClass =
    variant === 'destructive'
      ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
      : 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          {cancelLabel !== null && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${confirmButtonClass}`}
          >
            {loading ? '処理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
